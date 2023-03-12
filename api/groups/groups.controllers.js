import path from 'path'
import stream from 'stream'
import validator from 'validator'
import { ObjectId } from 'mongodb'
import mongo from '../utils/mongoUtil.js'
import { getStorage } from 'firebase-admin/storage'
import * as constants from '../constants/constants.js'

/**
 * This function handles creating a group.
 * When a request is sent to this endpoint, it checks whether or not the required details are provided by the user.
 * If they are provided, it creates a group and adds the user as the first group member and the group owner in the group details.
 * If they have not been provided, it returns a message saying that the user has provided insufficient group details.
 * If the user has provided the sufficient group details,
 * but the server is unable to create a group, it returns an error message letting the user know that the group has not been created.
 * 
 * @param {Object} req The name of the group and the group description
 * @param {Object} res The result that either the server has succeeded or failed in creating the group
 * @param {String} req.body.groupName The name of the group the user wants to create
 * @param {String} req.body.groupDescription The description of the group the user wants to create.
 * 
 * @throws {Errors} The user provides insufficient details
 */

const newGroup = async(req, res) =>
{
    if (validator.isAlphanumeric(req.body.groupName, 'en-IN', { ignore: ' ' }) && 
    validator.isAlphanumeric(req.body.groupDescription, 'en-IN', { ignore: ' ' }) && req.file)
    {
        const group = 
        {
            groupOwner: req.userid,
            createdAt: new Date(),
            groupName: req.body.groupName,
            groupDescription: req.body.groupDescription,
            members: [req.userid],
            memberRequests: []
        }

        const db = await mongo()
        const createGroupResponse = await db
            .collection(constants.groupsCollection)
            .insertOne(group)

        const updateInGroupOwnersProfileResponse = await db
            .collection(constants.usersCollection)
            .updateOne( 
                { 
                    _id : req.userid
                }, 
                { 
                    $addToSet : { userGroups : createGroupResponse.insertedId }
                })

        if (createGroupResponse.acknowledged == true && updateInGroupOwnersProfileResponse.acknowledged == true)
        {
            const firebaseBucket = getStorage().bucket()
            const filename = constants.groupsPicturesStorage + createGroupResponse.insertedId + path.extname(req.file.originalname) // Set filename for group picture to group uid
            const file = firebaseBucket.file(filename)

            const passthroughStream = new stream.PassThrough()
            passthroughStream.write(req.file.buffer)
            passthroughStream.end()

            passthroughStream.pipe(file.createWriteStream({ public: true })) // Pipe the write stream and wait for a finish or error event
                .on('finish', async () => 
                {
                    const db = await mongo()
                    const groupPictureUpdateResponse = await db // Map the uploaded picture to the group object
                        .collection(constants.groupsCollection)
                        .findOneAndUpdate(
                            {
                                _id: createGroupResponse.insertedId
                            },
                            {
                                $set: { groupPicture: file.metadata.mediaLink }
                            },
                            {
                                returnDocument: 'after' // Return the updated group object
                            })

                    res.status(200).send(groupPictureUpdateResponse.value) // Send the final group object back as a reponse
                })
                .on('error', async () => 
                {
                    res.status(500).send('Server error')
                })
        }
        else 
        {
            res.status(500).send("Error creating group")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure groupName and groupDescription are valid when creating a group")
    }
}

/**
 * The updateGroup function handles updating the details in the group.
 * When a request is made to this endpoint, it first checks if the user is authorized to edit the group i.e. they are the group owner.
 * If the user is not the group owner, it sends back a message saying the user is unauthorized.
 * If the user is authorized, it then checks if the details to update the group are sufficient.
 * If the details are not sufficient, it returns a message saying the same.
 * If the details are sufficient, then the group details are updated.
 * 
 * @param {Object} req The updated group id, the name of the group and the group description
 * @param {Object} res The response that the details of the group have been updated
 * @param {String} req.body.groupId The id of the group to be updated
 * @param {String} req.body.groupName The new name of the group
 * @param {String} req.body.groupDescription The new description of the group
 * 
 * @throws {Error} The group does not exist
 * @throws {Error} The user provides an incorrect group id
 * @throws {Error} The user is not authorized to update the group
 * @throws {Error} The user does not provide sufficient details to update the group
 */

const updateGroup = async(req, res) =>
{
    const {groupId, groupName, groupDescription} = req.body

    if(groupId && groupName && groupDescription)
    {
        const group = 
        {
            groupName: groupName,
            groupDescription: groupDescription
        }
        
        const db = await mongo()
        const groupData = await db
            .collection(constants.groupsCollection)
            .updateOne({ _id : new ObjectId(groupId)}, { $set: group})

        console.log(groupData)

        if (groupData.acknowledged = true)
        {
            if(groupData.matchedCount == 0)
            {
                res.status(404).send("Group not found")
            }
            if(groupData.modifiedCount == 0)
            {
                res.status(404).send("Group not updated")
            }
            if(groupData.matchedCount != 0 && groupData != 0)
            {
                res.status(200).send(group)
            }
            else
            {
                res.status(500).send("Server error")
            }
        }
        else 
        {
            res.status(500).send("Error updating group")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure groupId, groupName, and groupDescription are not empty when updating a post")
    }
}

const updateGroupBackground = async (req, res) =>
{
    const firebaseBucket = getStorage().bucket()
    const filename = constants.groupsBackgroundsStorage + req.body.groupId + path.extname(req.file.originalname) // Set filename for group picture to group uid
    const file = firebaseBucket.file(filename)

    const passthroughStream = new stream.PassThrough()
    passthroughStream.write(req.file.buffer)
    passthroughStream.end()

    console.log(req.body.groupId)

    passthroughStream.pipe(file.createWriteStream({ public: true })) // Pipe the write stream and wait for a finish or error event
        .on('finish', async () => 
        {
            const db = await mongo()
            const groupBackgroundUpdateResponse = await db // Map the uploaded picture to the group object
                .collection(constants.groupsCollection)
                .findOneAndUpdate(
                    {
                        _id: new ObjectId(req.body.groupId)
                    },
                    {
                        $set: { groupBackground: file.metadata.mediaLink }
                    },
                    {
                        returnDocument: 'after' // Return the updated group object
                    })

            res.status(200).send(groupBackgroundUpdateResponse.value) // Send the final group object back as a reponse
        })
        .on('error', async () => 
        {
            res.status(500).send('Server error')
        })
}

/**
 * The getGroupMembers function handles the returning of the list of the group members in a particular group.
 * When a request is made to this endpoint, it checks if the group exists.
 * If the group does not exist, it returns back a message saying that no group by that ID was found.
 * If the group exists, the function returns back a list of the members in that particular group.
 * 
 * @param {Object} req The id of the group whose members are being returned.
 * @param {object} res The response list of the members of a particular group.
 * @param {String} req.params.groupid The id of the group whose members are retrieved
 * 
 * @throws {Error} The group does no exist
 */

const getGroupMembers = async(req, res) =>
{
    const db = await mongo()
    const groupMembersData = await db
        .collection(constants.groupsCollection)
        .find({ _id: new ObjectId(req.params.groupid)}).toArray()

    if (groupMembersData.length == 0)
    {
        res.status(404).send("Group not found")
    }
    else
    {
        res.status(200).send(groupMembersData[0].members)
    }
}

/**
 * The deleteGroup function handles the deletion of a particular group.
 * When a request is made to this endpoint, it first checks if the group exists or not. 
 * If the group exists, it then checks whether the user that has called this endpoint, has the authorization to delete the group or not. 
 * If the user does have the authorization, the group is then deleted and a response message is sent for the same.
 * If the user does not have the authorization, an unauthorized response is sent to the user.
 * If the user has provided insufficient or incorrect details, an appropriate response is sent for the same.
 * 
 * @param {Object} req The group id
 * @param {Object} res The result that either the server has succeeded or failed in deleting a group.
 * @param {String} req.body.groupId The id of the group to be deleted
 * 
 * @throws {Error} The user is not authorized to delete the group


 */

const deleteGroup = async(req, res) =>
{
    const {groupId} = req.body

    console.log(groupId)

    if(groupId)
    {
        const db = await mongo()
        const groupData = await db
            .collection(constants.groupsCollection)
            .deleteOne({ "_id": new ObjectId(groupId)})

        if (groupData.acknowledged = true)
        {
            if(groupData.deletedCount == 0)
            {
                res.status(404).send("Group not found")
            }
            else
            {
                res.status(200).send("Successfully deleted group")  
            }          
        }
        else 
        {
            res.status(500).send("Error deleting group")
        }
    }
    else
    {
        res.status(400).send("Insufficient details. Ensure groupId is not empty when deleting a comment")
    }
}

/**
 * The getGroup function handles returning the details and stats of a particular group.
 * When a request is made to this endpoint, it first checks if the user has provided a group id.
 * If the user has not provided a group id, it returns an error saying the group id is not valid.
 * If the user has provided a correct group id, it checks if the group exists. 
 * If the group exists, the function sends a response of the group details and stats.
 * If the group does not exist, the function sends a response saying that no group has been found.
 * 
 * @param {Object} req The group id
 * @param {Object} res The result that is sent back to the client
 * @param {String} req.params.groupid The id of the group whose data is retrieved
 * 
 * @throws {Error} The group does no exist
 */

const getGroup = async(req, res) =>
{
    const db = await mongo()
    const groupData = await db
        .collection(constants.groupsCollection)
        .aggregate(
            [
                {
                    $match:
                    {
                        _id : new ObjectId(req.params.groupid)
                    }
                },
                {
                    $skip : 10 * req.params.page
                },
                {
                    $limit : 10
                }
            ]
        )

    if(groupData.length == 0)
    {
        res.status(404).send("Group not found")
    }
    else
    {
        res.status(200).send(groupData)
    }
}

/**
 *
 * The approveMemberRequest function handles responding whether or not a member has been approved to join the particular group or rejected.
 * When a request is made to this endpoint, the function checks if the request is made by an authorized user i.e. the group owner.
 * If the user does not have the authorization, an unauthorized response is sent to the user.
 * If the user does have the authorization, the user is then given a list of users that are pending approval or rejection to join the group.
 * If the owner approves a user, the user is then removed from the pending approval list and added to the group members list.
 * If the owner rejects a user, the user is then removed from the pending approval list and their application is rejected.
 * 
 * @param {Object} req The request object
 * @param {Object} res The response object
 * @param {String} req.body.groupId The
 * @param {String} req.body.memberId The
 */

const approveMemberRequest = async(req, res) =>
{
    const { groupId, memberId } = req.body

    const db = await mongo()
    const addToMembersResponse = await db  
        .collection(constants.groupsCollection)
        .updateOne( 
            { 
                _id : new ObjectId(groupId)
            }, 
            { 
                $addToSet : { members : memberId }
            })

    const removeFromPendingMembersResponse = await db
        .collection(constants.groupsCollection)
        .updateOne(
            { 
                _id : new ObjectId(groupId) 
            }, 
            { 
                $pull : { memberRequests : memberId } 
            })

    const addToMembersGroupsResponse = await db
        .collection(constants.usersCollection)
        .updateOne( 
            { 
                _id : memberId
            }, 
            { 
                $addToSet : { userGroups : groupId }
            })

    console.log(addToMembersGroupsResponse)
    console.log(removeFromPendingMembersResponse)
    console.log(addToMembersGroupsResponse)

    if(addToMembersResponse.modifiedCount == 1 && removeFromPendingMembersResponse.modifiedCount == 1 && addToMembersGroupsResponse.modifiedCount == 1)
    {
        res.status(200).send('Approved group member request')
    }
    else
    {
        res.status(403).send('Error approving group request')
    }
}

export {newGroup, updateGroup, updateGroupBackground, getGroupMembers, deleteGroup, getGroup, approveMemberRequest }