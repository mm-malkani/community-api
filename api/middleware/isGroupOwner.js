import { ObjectId } from 'mongodb'
import mongo from '../utils/mongoUtil.js'

async function isGroupOwner(req, res, next) 
{
    const {groupId, groupName, groupDescription} = req.body

    const db = await mongo()
    const data = await db
        .collection('groups')
        .find({ _id : new ObjectId(groupId) }).toArray()

    if(data[0].groupOwner == req.userid)
    {
        return res.status(401).send({ message: 'Not the group owner' });
    }
    else
    {
        return next()
    }

}

export { isGroupOwner }
