import { ObjectId } from 'mongodb'
import mongo from '../utils/mongoUtil.js'
import * as constants from '../constants/constants.js'

async function isCommentCreator(req, res, next) 
{
    const {commentId, commentText, parentCommentId} = req.body

    const db = await mongo()
    var commentLookupResponse
    
    if(!parentCommentId)
    {
        commentLookupResponse = await db.collection(constants.commentsCollection)
            .find({ _id : new ObjectId(commentId) }).toArray()
    }
    else
    {
        commentLookupResponse = await db.collection(constants.commentsCollection)
            .find(
                {
                    'childComments' : { $elemMatch : { "_id" : new ObjectId(commentId) } }
                }).toArray()
    }

    console.log('Comment lookup' + commentLookupResponse)

    if(commentLookupResponse[0].commentAuthor == req.userid)
    {
        return next()
    }
    else
    {
        return res.status(401).send({ message: 'Unauthorized Access: Cannot edit comments that are not your own' });
    }

}

export { isCommentCreator }
