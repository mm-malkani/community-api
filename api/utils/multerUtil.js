import multer, { MulterError } from 'multer'
import path  from 'path'

import * as constants from '../constants/constants.js'

const attachmentExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.py', '.cpp', '.pdf', '.js']
const pictureExtensions = ['.jpeg', '.jpg', '.png', '.webp']
const storage = multer.memoryStorage()

const multerAttachmentHelper = multer(
{
    storage: storage,
    limits: { fileSize : constants.maxUploadFileSize },
    fileFilter: (req, file, cb) =>
    {
        if (!attachmentExtensions.includes(path.extname(file.originalname)))
        {
            cb(new MulterError(400, 'Unsupported file extension'), false)
        }
        cb(null, true)
    }

}).single('attachment')

const multerUserPictureHelper = multer(
{
    storage: storage,    
    limits: { fileSize : constants.maxUploadFileSize },
    fileFilter: (req, file, cb) =>
    {
        if (!pictureExtensions.includes(path.extname(file.originalname)))
        {
            cb(new MulterError(400, 'Unsupported file extension'), false)
        }
        if(true)
        {
            console.log(req.file)
        }

        cb(null, true)
    }

}).single('userPicture')

const multerUserBackgroundHelper = multer(
{
    storage: storage,
    limits: { fileSize : constants.maxUploadFileSize },
    fileFilter: (req, file, cb) =>
    {
        if (!pictureExtensions.includes(path.extname(file.originalname)))
        {
            cb(new MulterError(400, 'Unsupported file extension'), false)
        }
        
        cb(null, true)
    }
    
}).single('userBackground')

const multerGroupPictureHelper = multer(
{
    storage: storage,
    limits: { fileSize: constants.maxUploadFileSize },
    fileFilter: (req, file, cb) =>
    {
        if (!pictureExtensions.includes(path.extname(file.originalname)))
        {
            cb(new MulterError(400, 'Unsupported file extension'), false)
        }
        if (true)
        {
            console.log(req.file)
        }

        cb(null, true)
    }

}).single('groupPicture')

const multerGroupBackgroundHelper = multer(
{
    storage: storage,
    limits: { fileSize: constants.maxUploadFileSize },
    fileFilter: (req, file, cb) =>
    {
        if (!pictureExtensions.includes(path.extname(file.originalname)))
        {
            cb(new MulterError(400, 'Unsupported file extension'), false)
        }

        cb(null, true)
    }

}).single('groupBackground')

// ----------------------------------- END OF HELPERS


function multerAttachment(req, res, next)
{
    multerAttachmentHelper(req, res, function(err)
    {
        if(err instanceof MulterError)
        {
            return res.status(400).json({message: err})
        }
        else if(err)
        {
            return res.status(501).send("Server error")
        }

        next()
    })
}

function multerUserPicture(req, res, next)
{
    multerUserPictureHelper(req, res, function(err)
    {
        if(err instanceof MulterError)
        {
            return res.status(400).json({message: err})
        }
        else if(err)
        {
            return res.status(501).send("Server error")
        }

        next()
    })
}

function multerUserBackground(req, res, next)
{
    multerUserBackgroundHelper(req, res, function(err)
    {
        if(err instanceof MulterError)
        {
            return res.status(400).json({message: err})
        }
        else if(err)
        {
            return res.status(501).send("Server error")
        }

        next()
    })
}

function multerGroupPicture(req, res, next)
{
    multerGroupPictureHelper(req, res, function(err)
    {
        if(err instanceof MulterError)
        {
            return res.status(400).json({message: err})
        }
        else if(err)
        {
            return res.status(501).send("Server error")
        }

        next()
    })
}

function multerGroupBackground(req, res, next)
{
    multerGroupBackgroundHelper(req, res, function(err)
    {
        if(err instanceof MulterError)
        {
            return res.status(400).json({message: err})
        }
        else if(err)
        {
            return res.status(501).send("Server error")
        }

        next()
    })
}

export { multerAttachment, multerUserPicture, multerUserBackground, multerGroupPicture, multerGroupBackground }