import { Router } from 'express'
import { multerAttachment } from '../utils/multerUtil.js'
import { isPostCreator } from '../middleware/isPostCreator.js'
import { isAuthenticated } from '../middleware/isAuthenticated.js'
import { isCommentCreator } from '../middleware/isCommentCreator.js'

import { createPost, addAttachmentToPost, deleteAttachmentFromPost, getPost, updatePost, deletePost, changePostVisibility, getPostsByUser, getPostsByGroup, likePost, createComment, getComments, updateComment, deleteComment, likeComment, unlikeComment } from './posts.controllers.js'

const postsRouter = Router()

postsRouter.put('/createPost', isAuthenticated, createPost)

postsRouter.put('/addAttachmentToPost', isAuthenticated, multerAttachment, addAttachmentToPost)

postsRouter.put('/deleteAttachmentFromPost', isAuthenticated, deleteAttachmentFromPost)

postsRouter.get('/getPost/:postid', isAuthenticated, getPost)

postsRouter.put('/updatePost', isAuthenticated, isPostCreator, updatePost)

postsRouter.put('/deletePost', isAuthenticated, isPostCreator, deletePost)

postsRouter.put('/changePostVisibility', isAuthenticated, isPostCreator, changePostVisibility)

postsRouter.get('/getPostsByUser/:userid/:page', isAuthenticated, getPostsByUser)

postsRouter.get('/getPostsByGroup/:groupid/:page', isAuthenticated, getPostsByGroup)

postsRouter.put('/likePost', isAuthenticated, likePost)

postsRouter.put('/createComment', isAuthenticated, createComment)

postsRouter.get('/getComments/:postid/:page', isAuthenticated, getComments)

postsRouter.put('/updateComment', isAuthenticated, isCommentCreator, updateComment)

postsRouter.put('/deleteComment', isAuthenticated, isCommentCreator, deleteComment)

postsRouter.put('/likeComment', isAuthenticated, likeComment)

export default postsRouter