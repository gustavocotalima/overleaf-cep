import PackageManager from './PackageManager.mjs'
import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.js'
import { expressify } from '@overleaf/promise-utils'

// Validate package name - only allow safe characters
const PACKAGE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

/**
 * Install a LaTeX package
 * POST /project/:project_id/package/install
 */
async function installPackage(req, res) {
  const { packageName } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!packageName || typeof packageName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Package name is required',
    })
  }

  if (!PACKAGE_NAME_REGEX.test(packageName)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid package name. Only alphanumeric characters, hyphens, and underscores are allowed.',
    })
  }

  logger.info({ userId, packageName }, 'User installing LaTeX package')

  try {
    const result = await PackageManager.installPackage(packageName)
    res.json(result)
  } catch (error) {
    logger.error({ error, userId, packageName }, 'Package installation failed')
    res.status(500).json({
      success: false,
      error: error.message || 'Package installation failed',
    })
  }
}

/**
 * Search for LaTeX packages
 * GET /project/:project_id/package/search?query=xxx
 */
async function searchPackages(req, res) {
  const { query } = req.query

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Search query is required',
    })
  }

  if (!PACKAGE_NAME_REGEX.test(query)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid search query',
    })
  }

  try {
    const result = await PackageManager.searchPackages(query)
    res.json(result)
  } catch (error) {
    logger.error({ error, query }, 'Package search failed')
    res.status(500).json({
      success: false,
      error: error.message || 'Package search failed',
    })
  }
}

export default {
  installPackage: expressify(installPackage),
  searchPackages: expressify(searchPackages),
}
