import { Router } from 'express'
import { multerUserPicture, multerUserBackground } from '../utils/multerUtil.js'
import { isAuthenticated } from '../middleware/isAuthenticated.js'
import { publishToCurrencyQueue, publishToEmailQueue } from '../utils/mqUtil.js'
import * as constants from '../constants/constants.js'

import { createUser, getUser, getSelf, updateUser, updateUserBackground, sendGroupJoinRequest, cancelGroupJoinRequest, leaveGroup, followUser, unfollowUser, getUserFeed } from './users.controller.js'
const usersRouter = Router()

usersRouter.put('/createUser', multerUserPicture, createUser)

usersRouter.get('/getUser/:userid', isAuthenticated, getUser)

usersRouter.get('/getSelf', isAuthenticated, getSelf)

usersRouter.put('/updateUser', isAuthenticated, updateUser)

usersRouter.put('/updateUserBackground', isAuthenticated, multerUserBackground, updateUserBackground)

usersRouter.put('/sendGroupJoinRequest', isAuthenticated, sendGroupJoinRequest)

usersRouter.put('/cancelGroupJoinRequest', isAuthenticated, cancelGroupJoinRequest)

usersRouter.put('/leaveGroup', isAuthenticated, leaveGroup)

usersRouter.put('/followUser', isAuthenticated, followUser)

usersRouter.put('/unfollowUser', isAuthenticated, unfollowUser)

usersRouter.get('/feed/:userid/:sort/:page', isAuthenticated, getUserFeed)

export default usersRouter