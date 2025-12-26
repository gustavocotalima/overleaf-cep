import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'

const CLSI_URL = Settings.apis?.clsi?.url || 'http://localhost:3013'

/**
 * Install a LaTeX package via CLSI
 * @param {string} packageName - Name of the package to install
 * @returns {Promise<{success: boolean, message: string, output?: string}>}
 */
async function installPackage(packageName) {
  logger.info({ packageName }, 'Installing LaTeX package via CLSI')

  const url = `${CLSI_URL}/packages/install`

  try {
    const response = await fetchJson(url, {
      method: 'POST',
      json: { packageName },
      timeout: 180000, // 3 minutes timeout for installation
    })

    logger.info({ packageName, response }, 'Package installation completed')
    return response
  } catch (error) {
    logger.error({ error, packageName }, 'Package installation failed')

    // Try to extract error details from response
    if (error.response) {
      try {
        const errorBody = await error.response.json()
        throw new Error(errorBody.error || 'Installation failed')
      } catch (parseError) {
        // If we can't parse the error, re-throw original
      }
    }

    throw error
  }
}

/**
 * Search for LaTeX packages via CLSI
 * @param {string} query - Search query
 * @returns {Promise<{packages: string[], total: number}>}
 */
async function searchPackages(query) {
  logger.info({ query }, 'Searching LaTeX packages via CLSI')

  const url = `${CLSI_URL}/packages/search?query=${encodeURIComponent(query)}`

  try {
    const response = await fetchJson(url, {
      method: 'GET',
      timeout: 30000,
    })

    return response
  } catch (error) {
    logger.error({ error, query }, 'Package search failed')
    throw error
  }
}

export default {
  installPackage,
  searchPackages,
  promises: {
    installPackage,
    searchPackages,
  },
}
