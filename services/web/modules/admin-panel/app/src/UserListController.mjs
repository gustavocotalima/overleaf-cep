import _ from 'lodash'
import pick from 'lodash'
import crypto from 'crypto'

import Metrics from '@overleaf/metrics'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.js'
import UserGetter from '../../../../app/src/Features/User/UserGetter.js'
import UserDeleter from '../../../../app/src/Features/User/UserDeleter.mjs'
import ProjectDeleter from '../../../../app/src/Features/Project/ProjectDeleter.mjs'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.mjs'
import { expressify, promiseMapWithLimit } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import { OError } from '../../../../app/src/Features/Errors/Errors.js'
import EmailHandler from '../../../../app/src/Features/Email/EmailHandler.js'
import { User } from '../../../../app/src/models/User.js'
import { DeletedUser } from '../../../../app/src/models/DeletedUser.js'
import { DeletedProject } from '../../../../app/src/models/DeletedProject.js'
import { AUTH_TYPE } from './auth-types.mjs'
import HttpErrorHandler from '../../../../app/src/Features/Errors/HttpErrorHandler.js'

import Path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = Path.dirname(fileURLToPath(import.meta.url))

class ShowInModalError extends OError {}

const authTypes = AUTH_TYPE.LOCAL
  | (process.env.EXTERNAL_AUTH?.includes('ldap') ? AUTH_TYPE.LDAP : 0)
  | (process.env.EXTERNAL_AUTH?.includes('saml') ? AUTH_TYPE.SAML : 0)
  | (process.env.EXTERNAL_AUTH?.includes('oidc') ? AUTH_TYPE.OIDC : 0)

function cleanupSession(req) {
  // cleanup redirects at the end of the redirect chain
  delete req.session.postCheckoutRedirect
  delete req.session.postLoginRedirect
  delete req.session.postOnboardingRedirect
}

async function userListPage(req, res, next) {
  cleanupSession(req)

  const userId = SessionManager.getLoggedInUserId(req.session)

  const usersBlobPending = _getUsers().catch(err => {
    logger.err({ err }, 'users listing in background failed')
    return undefined
  })

  const prefetchedUsersBlob = await usersBlobPending

  Metrics.inc('user-list-prefetch-users', 1, {
    status: prefetchedUsersBlob ? 'success' : 'error',
  })

  res.render(Path.resolve(__dirname, '../views/user-list-react'), {
    title: 'Manage Users',
    prefetchedUsersBlob,
    authTypes,
  })
}

async function registerNewUser(req, res, next) {
  const { email, isExternal, isAdmin } = req.body
  if (email == null || email === '') {
    return res.status(422).send({ message: 'Email address is empty' })
  }
  delete req.body.isExternal
  req.body.password = crypto.randomBytes(32).toString('hex')

 let user
  try {
    user = await UserRegistrationHandler.promises.registerNewUser(req.body)
  } catch (err) {
    OError.tag(err, 'error with registerNewUser', { email })

    if (err.message == 'EmailAlreadyRegistered') {
      return res.status(409).json({
        success: false,
        error: 'email_registered',
        message: 'email_already_registered',
      })
    }
    if (err.message === 'InvalidEmailError') {
      return res.status(400).json({
        success: false,
        error: 'request_invalid',
        message: 'email_address_is_invalid',
      })
    }
    if (err.message === 'InvalidPasswordError') {
      return res.status(400).json({
        success: false,
        error: 'request_invalid',
        message: 'try_again',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Internal Server Error',
    })
  }

  try {
    const reversedHostname = user.email
      .split('@')[1]
      .split('')
      .reverse()
      .join('')
    const update = {
      $set: { isAdmin, emails: [{ email, reversedHostname, confirmedAt: Date.now() }] },
    }
    if (isExternal) {
      update.$unset = { hashedPassword: "" }
    } else {
      await UserRegistrationHandler.promises.registerNewUserAndSendActivationEmail(email)
    }
    await User.updateOne({ _id: user._id }, update).exec()
  } catch (err) {
    OError.tag(err, 'error setting user to admin', {
      user_id: user._id,
    })
    throw err
  }
  
  const authFlags = isExternal ? 0 : AUTH_TYPE.LOCAL
  const { id, first_name, last_name, signUpDate, lastActive, suspended } = user
  const newUser = { id, email, first_name, last_name, isAdmin, signUpDate, lastActive, suspended, inactive: true, deleted: false, authFlags }
  res.json({ user: newUser })
}

async function getUsersJson(req, res) {
  const { filters, page, sort } = req.body
  const usersPage = await _getUsers(filters, sort, page)
  res.json(usersPage)
}

async function _getUsers(
  filters = {},
  sort = { by: 'signUpDate', order: 'desc' },
  page = { size: 20 }
) {
  const projection = {
    _id: 1,
    email: 1,
    first_name: 1,
    last_name: 1,
    lastActive: 1,
    signUpDate: 1,
    loginCount: 1,
    isAdmin: 1,
    hashedPassword: 1,
    samlIdentifiers: 1,
    thirdPartyIdentifiers: 1,
    suspended: 1,
  }
  const projectionDeleted = {};
  for (const key of Object.keys(projection)) {
    projectionDeleted[key] = `$user.${key}`
  }
  projectionDeleted.deletedId = { $toString: '$_id' }
  projectionDeleted.deletedAt = '$deleterData.deletedAt'

  const activeUsers = await UserGetter.promises.getUsers({}, projection)
  const deletedUsers = await DeletedUser.aggregate([
    { $match: { user: { $type: 'object' } } },
    { $project: projectionDeleted },
  ])

  const allUsers = [...activeUsers, ...deletedUsers]

  const formattedUsers = _formatUsers(allUsers)

  const filteredUsers = _applyFilters(formattedUsers, filters)
  const users = _sortAndPaginate(filteredUsers, sort, page)

  return {
    totalSize: filteredUsers.length,
    users,
  }
}

function _formatUsers(users) {
  const formattedUsers = []
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)

  for (const user of users) {
    formattedUsers.push(
      _formatUserInfo(user, yearAgo)
    )
  }

  return formattedUsers
}

function _applyFilters(users, filters) {
  if (!_hasActiveFilter(filters)) {
    return users
  }
  return users.filter(user => _matchesFilters(user, filters))
}

function _sortAndPaginate(users, sort, page) {
  if (
    (sort.by && !['lastActive', 'signUpDate', 'email', 'name'].includes(sort.by)) ||
    (sort.order && !['asc', 'desc'].includes(sort.order))
  ) {
    throw new OError('Invalid sorting criteria', { sort })
  }

  const sortedUsers = _.orderBy(
    users,
    [sort.by || 'signUpDate'],
    [sort.order || 'desc']
  )
  // TODO handle pagination
  return sortedUsers
}

function _formatUserInfo(user, maxDate) {
  let authFlags = 0
  if (user.hashedPassword) authFlags |= AUTH_TYPE.LOCAL
  if (user.samlIdentifiers.length > 0) authFlags |= AUTH_TYPE.SAML
  if (user.thirdPartyIdentifiers.length > 0) authFlags |= AUTH_TYPE.OIDC
// If none of the above, mark as LDAP
  if (authFlags === 0 && user.loginCount !== 0) authFlags |= AUTH_TYPE.LDAP

  return {
    id: user._id.toString(),
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    isAdmin: user.isAdmin,
    loginCount: user.loginCount,
    signUpDate: user.signUpDate,
    lastActive: user.lastActive,
    authFlags: authFlags,
    ...(user.suspended && { suspended: user.suspended }),
    inactive: !user.lastActive || user.lastActive < maxDate,
    ...(user.deletedId && { deletedId: user.deletedId }),
    ...(user.deletedAt && { deletedAt: user.deletedAt }),
    deleted: Boolean(user.deletedId),
  }
}

function _matchesFilters(user, filters) {
  if (
    filters.search?.length &&
    user.email.toLowerCase().indexOf(filters.search.toLowerCase()) === -1 &&
    user.first_name.toLowerCase().indexOf(filters.search.toLowerCase()) === -1 &&
    user.last_name.toLowerCase().indexOf(filters.search.toLowerCase()) === -1
  ) { return false }
  // Deleted users only match the 'deleted' filter
  if (user.deleted) return Boolean(filters.deleted)
  if (filters.all) return true
  if (filters.admin) return user.isAdmin
  if (filters.inactive && !user.inactive) return false
  if (filters.suspended && !user.suspended) return false
  if (filters.local && !(user.authFlags & AUTH_TYPE.LOCAL)) return false
  if (filters.saml  && !(user.authFlags & AUTH_TYPE.SAML))  return false
  if (filters.oidc  && !(user.authFlags & AUTH_TYPE.OIDC))  return false
  if (filters.ldap  && !(user.authFlags & AUTH_TYPE.LDAP))  return false
  return true
}

function _hasActiveFilter(filters) {
  return Boolean(
    filters.deleted ||
    filters.all ||
    filters.admin ||
    filters.inactive ||
    filters.suspended ||
    filters.local ||
    filters.saml ||
    filters.oidc ||
    filters.ldap ||
    filters.search?.length
  )
}

async function deleteNormalUser(req, res, next) {
  const deleterUserId = SessionManager.getLoggedInUserId(req.session)
  const { userId } = req.params
  const { skipEmail } = req.body

  logger.debug({ deleterUserId, userId }, 'admin is trying to delete user account')
  try {
    await UserDeleter.promises.deleteUser(userId, {
      deleterUser: { '_id': deleterUserId },
      ipAddress: req.ip,
      skipEmail,
    })
  } catch (err) {
    logger.warn({ deleterUser, userId }, err.message)
    const messageForModal = 'Something went wrong. Does the account still exist?'
    return HttpErrorHandler.unprocessableEntity(req, res, messageForModal)
  }

  const deletedUser = await DeletedUser.findOne(
    { 'user._id': userId }, { _id: 1, 'deleterData.deletedAt': 1 }
  ).lean()

  res.json({ deletedId: deletedUser._id.toString(), deletedAt: deletedUser.deleterData.deletedAt })
}

async function purgeDeletedUser(req, res, next) {
  const deleterUserId = SessionManager.getLoggedInUserId(req.session)
  const userId = req.params.userId

  logger.debug({ deleterUserId, userId }, 'admin is trying to purge deleted user account')
  try {
    UserDeleter.promises.expireDeletedUser(userId)
  } catch (err) {
    logger.warn({ restorerId, userId }, err.message)
    const messageForModal = 'Something went wrong. The user is already deleted?'
    return HttpErrorHandler.unprocessableEntity(req, res, messageForModal)
  }
  res.sendStatus(200)
}

async function restoreDeletedUser(req, res, next) {
  const restorerId = SessionManager.getLoggedInUserId(req.session)
  const userId = req.params.userId

  logger.debug({ restorerId, userId }, 'admin is trying to restore deleted user')

  let userData
  try {
    const deletedEntry = await DeletedUser.findOne( { "user._id": userId }).lean()
    userData = deletedEntry?.user
    if (!userData) {
      const message = 'Something went wrong. The user is purged?'
      throw new ShowInModalError(message)
    }

    const exists = await User.findOne({ email: userData.email }, { _id: 1 }).lean()
    if (exists) {
      const message = 'cannot_restore_account_with_email_exists'
      throw new ShowInModalError(message)
    }

    userData.suspended = false
    await User.create(userData)
    await DeletedUser.deleteOne({ "user._id": userId })

  } catch (err) {
    let messageForModal
    if (err instanceof ShowInModalError) {
      messageForModal = err.message
    } else {
      messageForModal = 'Something went wrong. Try again'
    }
    logger.warn({ restorerId, userId }, err.message)
    return HttpErrorHandler.unprocessableEntity(req, res, messageForModal)
  }

  try {
    const projects = await DeletedProject.find({ "project.owner_ref": userId }).exec()
    logger.info(
      { userId, projectCount: projects.length },
      'found user projects to restore'
    )
    await promiseMapWithLimit(5, projects, project =>
      ProjectDeleter.promises.undeleteProject(project.deleterData.deletedProjectId, { suffix: "" }))
  } catch (err) {
    logger.info({ userId }, err.message)
  }

  return res.json({
    restoredId: userData._id.toString(),
    email: userData.email,
  })
}

async function flagUser(req, res, next) {
  const userId = req.params.userId
  const flag = req.body

  logger.debug({ flag, userId }, 'admin is trying to change user status')

  try {
    await User.updateOne(
      { _id: userId },
      { $set: flag }
    ).exec()
  } catch (err) {
    logger.warn({ flag, userId }, err.message)
    const messageForModal = 'Something went wrong. Cannot change the user status.'
    return HttpErrorHandler.unprocessableEntity(req, res, messageForModal)
  }
  res.sendStatus(200)
}

export default {
  userListPage: expressify(userListPage),
  getUsersJson: expressify(getUsersJson),
  registerNewUser: expressify(registerNewUser),
  deleteNormalUser: expressify(deleteNormalUser),
  restoreDeletedUser: expressify(restoreDeletedUser),
  purgeDeletedUser: expressify(purgeDeletedUser),
  flagUser: expressify(flagUser),
}
