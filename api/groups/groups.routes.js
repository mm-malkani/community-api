import { Router } from 'express'
import { isAuthenticated } from '../middleware/isAuthenticated.js'
import { isGroupOwner } from '../middleware/isGroupOwner.js'
import { multerGroupPicture, multerGroupBackground } from '../utils/multerUtil.js'
import { newGroup, updateGroup, updateGroupBackground, getGroupMembers, deleteGroup, getGroup, approveMemberRequest } from './groups.controllers.js'
const groupsRouter = Router()

groupsRouter.put('/newGroup', isAuthenticated, multerGroupPicture, newGroup)

groupsRouter.put('/updateGroup', isAuthenticated, isGroupOwner, updateGroup)

groupsRouter.put('/updateGroupBackground', isAuthenticated, multerGroupBackground, updateGroupBackground)

groupsRouter.get('/getGroupMembers/:groupid', isAuthenticated, getGroupMembers)

groupsRouter.put('/deleteGroup', isAuthenticated, isGroupOwner, deleteGroup)

groupsRouter.get('/getGroup/:groupid/:page', isAuthenticated, getGroup)

groupsRouter.put('/approveMemberRequest', isAuthenticated, isGroupOwner, approveMemberRequest)

export default groupsRouter