const { spawn } = require('node:child_process')
const logger = require('@overleaf/logger')
const Path = require('node:path')
const fs = require('node:fs')

// Whitelist of allowed package name patterns (alphanumeric, hyphens, underscores)
const PACKAGE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

// Maximum time for package installation (2 minutes)
const INSTALL_TIMEOUT = 120000

/**
 * Install a LaTeX package using tlmgr
 */
function installPackage(req, res) {
  const { packageName } = req.body

  if (!packageName || typeof packageName !== 'string') {
    return res.status(400).json({
      error: 'Package name is required',
    })
  }

  // Validate package name to prevent command injection
  if (!PACKAGE_NAME_REGEX.test(packageName)) {
    return res.status(400).json({
      error: 'Invalid package name. Only alphanumeric characters, hyphens, and underscores are allowed.',
    })
  }

  logger.info({ packageName }, 'Installing LaTeX package')

  // Run tlmgr install
  const proc = spawn('tlmgr', ['install', packageName], {
    timeout: INSTALL_TIMEOUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  proc.stdout.on('data', data => {
    stdout += data.toString()
  })

  proc.stderr.on('data', data => {
    stderr += data.toString()
  })

  proc.on('error', err => {
    logger.error({ err, packageName }, 'Error spawning tlmgr')
    res.status(500).json({
      error: 'Failed to start package installation',
      details: err.message,
    })
  })

  proc.on('close', code => {
    if (code === 0) {
      logger.info({ packageName, stdout }, 'Package installed successfully')

      // Create symlinks for any new binaries (like biber)
      createSymlinksForPackage(packageName)

      res.json({
        success: true,
        message: `Package '${packageName}' installed successfully`,
        output: stdout,
      })
    } else {
      logger.warn({ packageName, code, stderr, stdout }, 'Package installation failed')

      // Check if package doesn't exist
      if (stderr.includes('not found in package repositories') ||
          stdout.includes('not found in package repositories')) {
        res.status(404).json({
          error: `Package '${packageName}' not found in TeX Live repositories`,
          output: stderr || stdout,
        })
      } else {
        res.status(500).json({
          error: 'Package installation failed',
          output: stderr || stdout,
        })
      }
    }
  })
}

/**
 * Search for a package in TeX Live
 */
function searchPackage(req, res) {
  const { query } = req.query

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Search query is required',
    })
  }

  // Validate query
  if (!PACKAGE_NAME_REGEX.test(query)) {
    return res.status(400).json({
      error: 'Invalid search query',
    })
  }

  logger.info({ query }, 'Searching for LaTeX package')

  const proc = spawn('tlmgr', ['search', '--global', query], {
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  proc.stdout.on('data', data => {
    stdout += data.toString()
  })

  proc.stderr.on('data', data => {
    stderr += data.toString()
  })

  proc.on('error', err => {
    logger.error({ err, query }, 'Error searching packages')
    res.status(500).json({
      error: 'Failed to search packages',
    })
  })

  proc.on('close', code => {
    if (code === 0) {
      // Parse results - each line is "package - description" or just "package:"
      const packages = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/^([^:\s]+)/)
          return match ? match[1] : null
        })
        .filter(Boolean)
        .slice(0, 20) // Limit to 20 results

      res.json({
        packages,
        total: packages.length,
      })
    } else {
      res.status(500).json({
        error: 'Search failed',
        output: stderr,
      })
    }
  })
}

/**
 * Create symlinks in /usr/local/bin for newly installed binaries
 */
function createSymlinksForPackage(packageName) {
  // Find the TeX Live bin directory
  const texliveBinDirs = [
    '/usr/local/texlive/2025/bin/aarch64-linux',
    '/usr/local/texlive/2025/bin/x86_64-linux',
    '/usr/local/texlive/2024/bin/aarch64-linux',
    '/usr/local/texlive/2024/bin/x86_64-linux',
  ]

  let texliveBinDir = null
  for (const dir of texliveBinDirs) {
    if (fs.existsSync(dir)) {
      texliveBinDir = dir
      break
    }
  }

  if (!texliveBinDir) {
    logger.warn('Could not find TeX Live bin directory')
    return
  }

  // Known packages that install binaries
  const packageBinaries = {
    biber: ['biber'],
    latexmk: ['latexmk'],
    xindy: ['xindy', 'texindy'],
    // Add more as needed
  }

  const binaries = packageBinaries[packageName]
  if (!binaries) return

  for (const binary of binaries) {
    const source = Path.join(texliveBinDir, binary)
    const target = Path.join('/usr/local/bin', binary)

    if (fs.existsSync(source) && !fs.existsSync(target)) {
      try {
        fs.symlinkSync(source, target)
        logger.info({ binary, source, target }, 'Created symlink for binary')
      } catch (err) {
        logger.warn({ err, binary }, 'Failed to create symlink')
      }
    }
  }
}

module.exports = {
  installPackage,
  searchPackage,
}
