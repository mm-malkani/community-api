import { ObjectId } from 'mongodb'
import mongo from '../utils/mongoUtil.js'

async function isPostCreator(req, res, next) 
{
    const {postId} = req.body

    const db = await mongo()
    const data = await db
        .collection('posts')
        .find({_id : new ObjectId(postId)}).toArray()

    if(data[0].postAuthor == req.userid)
    {
        return next()
    }
    else
    {
        return res.status(401).send({ message: 'Not the post creator' });

    }

}

export { isPostCreator }
