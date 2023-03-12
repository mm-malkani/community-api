import path from 'path'
import stream from 'stream'
import validator from 'validator'
import { ObjectId } from 'mongodb'
import mongo from '../utils/mongoUtil.js'
import admin from '../utils/firebaseUtil.js'
import { getStorage } from 'firebase-admin/storage'
import { publishToCurrencyQueue, publishToEmailQueue } from '../utils/mqUtil.js'

import * as constants from '../constants/constants.js'

/**
 * The creatUser function first checks if all the req fields are populated, checks if the provided email address and password are valid,
 * then checks that a user with the provided email does not exist in the database. If all these checks pass, vit uses firebaseAuth to 
 * create a user with the provided email and password, then creates that user with the firebase uid in the users collection in the database.
 * It then uploads the provided userPicture file to a Firebase Storage bucket, and after successfully uploading it, maps the picture's 
 * public URL to the userPicture field for the user created in the database.
 * 
 * @param {Object} req The user email, password, phone number, username, display name, location, gender, age and professio
 * @param {Object} res The result that the server has succeeded or failed in creating the account.
 * @param {string} req.body.userEmail The email address of the user
 * @param {string} req.body.userPassword 
 * @param {string} req.body.userPhoneNumber 
 * @param {string} req.body.userUsername 
 * @param {string} req.body.userDisplayName 
 * @param {file} req.body.file 
 * @param {string} req.body.userLocation 
 * @param {string} req.body.userGender 
 * @param {string} req.body.userAge 
 * @param {string} req.body.userProfession 
 * 
 * @throws {Error} If an account with this email already exists
 * @throws {Error} If the email address is invalid
 * @throws {Error} If the password is invalid
 * @throws {Error} If the file could not be uploaded
 * @throws {Error} If any of the request fields are empty
 */

const createUser = async (req, res) =>
{
    if (validator.isEmail(req.body.userEmail) &&
        validator.isStrongPassword(req.body.userPassword) &&
        validator.isMobilePhone(req.body.userPhoneNumber, 'en-IN') &&
        validator.isAlphanumeric(req.body.userUsername) && req.body.userUsername.length <= 20 && req.body.userUsername.length >= 5 &&
        validator.isAlphanumeric(req.body.userDisplayName, 'en-IN', { ignore: ' ' }) &&
        validator.isAlphanumeric(req.body.userLocation, 'en-IN', { ignore: ' ' }) &&
        validator.isAlpha(req.body.userGender, 'en-IN', { ignore: ' ' }) &&
        validator.isNumeric(req.body.userAge) && 18 < req.body.userAge && req.body.userAge < 100 &&
        validator.isAlpha(req.body.userProfession, 'en-IN', { ignore: ' ' }) && req.file)
    {
        const db = await mongo()
        const duplicateEmailCheckResponse = await db
            .collection(constants.usersCollection)
            .find(
                {
                    userEmail: req.body.userEmail

                }).toArray() // Check that no user already exists with this email

        const duplicateUsernameCheckResponse = await db
            .collection(constants.usersCollection)
            .find(
                {
                    userUsername: req.body.userUsername

                }).toArray() // Check that no user already exists with this username

        if (duplicateEmailCheckResponse.length == 0 && duplicateUsernameCheckResponse.length == 0)
        {
            const createUserResponse = await admin.auth().createUser(
                {
                    email: req.body.userEmail.trim().toLowerCase(),
                    password: req.body.userPassword,
                    emailVerified: false,
                    disabled: false
                })

            const user =
            {
                _id: createUserResponse.uid,
                userEmail: validator.normalizeEmail(createUserResponse.email),
                emailVerified: false,
                userPhoneNumber: validator.trim(req.body.userPhoneNumber),
                userUsername: validator.trim(req.body.userUsername).toLowerCase(),
                userDisplayName: validator.trim(req.body.userDisplayName),
                userPicture: null, // Create with null, map the URL for this once the upload is complete
                userBackground: null, // Create with null, user can add a background later
                userLocation: validator.trim(req.body.userLocation),
                userGender: validator.trim(req.body.userGender),
                userAge: validator.trim(req.body.userAge),
                userProfession: validator.trim(req.body.userProfession),
                disabled: false,
                followers: [],
                following: []
            }

            const createUserInDbResponse = await db
                .collection(constants.usersCollection)
                .insertOne(user)

            if (createUserInDbResponse.acknowledged = true)
            {
                const firebaseBucket = getStorage().bucket()
                const filename = constants.usersPicturesStorage + user._id + path.extname(req.file.originalname) // Set filename for user picture to match uid
                const file = firebaseBucket.file(filename)

                const passthroughStream = new stream.PassThrough()
                passthroughStream.write(req.file.buffer)
                passthroughStream.end()

                passthroughStream.pipe(file.createWriteStream({ public: true })) // Pipe the write stream and wait for a finish or error event
                    .on('finish', async () => 
                    {
                        const db = await mongo()
                        const userPictureUpdateResponse = await db // Map the uploaded picture to the user profile
                            .collection(constants.usersCollection)
                            .findOneAndUpdate(
                                {
                                    _id: user._id
                                },
                                {
                                    $set: { userPicture: file.metadata.mediaLink }
                                },
                                {
                                    returnDocument: 'after' // Return the updated user object
                                })

                        res.status(200).send(userPictureUpdateResponse.value) // Send the final user object back as a reponse
                    })
                    .on('error', async () => 
                    {
                        res.status(500).send('Server error')
                    })
            }
        }
        else
        {
            res.status(403).send('An account already exists with this username or email address')
        }
    }
    else if (!validator.isEmail(req.body.userEmail))
    {
        res.status(403).send('Invalid email address')
    }
    else if (!validator.isStrongPassword(req.body.userPassword))
    {
        res.status(403).send('Invalid password. Password must contain one digit from 1 to 9, one lowercase letter, one uppercase letter, one special character, no space, and it must be 8-16 characters long.')
    }
    else if (!validator.isMobilePhone(req.body.userPhoneNumber, 'en-IN'))
    {
        res.status(403).send('Invalid phone number.')
    }
    else if (!validator.isAlphanumeric(req.body.userUsername) || req.body.userUsername.length > 20 || 5 > req.body.userUsername.length)
    {
        res.status(403).send('Invalid username. Usernames must be an alphanumeric value less than 20 characters in length.')
    }
    else if (!validator.isAlphanumeric(req.body.userDisplayName, 'en-IN', { ignore: ' ' }))
    {
        res.status(403).send('Invalid display name. Display names must be an alphanumeric value.')
    }
    else if (!validator.isAlphanumeric(req.body.userLocation, 'en-IN', { ignore: ' ' }))
    {
        res.status(403).send('Invalid location. Location must be an alphanumeric value.')
    }
    else if (!validator.isAlpha(req.body.userGender, 'en-IN', { ignore: ' ' }))
    {
        res.status(403).send('Invalid gender. Gender must be an alphabetical value.')
    }
    else if (!validator.isNumeric(req.body.userAge) || 18 > req.body.userAge || req.body.userAge > 100)
    {
        res.status(403).send('Invalid age. Age must be a numeric value between 18 and 100.')
    }
    else if (!validator.isAlpha(req.body.userProfession, 'en-IN', { ignore: ' ' }))
    {
        res.status(403).send('Invalid profession. Profession must be an alphabetical value.')
    }
    else if (!req.file)
    {
        res.status(403).send('Could not upload file. Uploads should be of a valid file type and less than 5MB')
    }
    else
    {
        res.status(403).send('Bad request. Please make sure userEmail, userPassword, userPhoneNumber, userUsername, userDisplayName, userPicture, userLocation, userGender, userAge, userProfession are passed in the reqest.')
    }
}

/**
 * The getUser function retrieves a user from the database.
 * When a request is sent to this endpoint, it checks if the user id provided is valid user id.
 * If the user id is not valid, it responds with an error of the user id not valid.
 * If the user id is valid,it then retrieves the user data from the database while masking the user's email id and phone number.
 * 
 * @param {Object} req The userid of the user whose data we wish to retrieve
 * @param {Object} res The result that is sent back to the client
 * @param {string} req.params.userid The id of the user to retrieve from the GET request params
 * 
 * @throws {Error} If an no user was found with the given user id
 */

const getUser = async (req, res) =>
{
    const db = await mongo()
    const getUserResponse = await db
        .collection(constants.usersCollection)
        .find(
            {
                _id: req.params.userid

            }).toArray()

    getUserResponse[0].email = getUserResponse[0].email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c) // Masking the email

    res.status(200).send(getUserResponse)
}

/**
 * The getSelf function retrieves a user's own profile from the database.
 * When a request is made to this endpoint, it sends a response which contains the user's own profile.
 * 
 * @param {Object} req The userid of the person sending the request
 * @param {Object} res The result that is sent back to the client
 * @param {string} req.userid The id of the user retrieved from the auth token
 * 
 * @throws {Error} If there was an error from the server
 */

const getSelf = async(req,res) =>
{
    const db = await mongo()
    const getUserResponse = await db
        .collection(constants.usersCollection)
        .find(
            {
                _id: req.userid

            }).toArray()

    res.status(200).send(getUserResponse)
}

/**
 * The updateUser function updates the user's profile with the new data sent by the user.
 * When a request is made to this endpoint, it checks the fields which have been updated.
 * It then updates the corresponding fields in the user's profile in the database.
 * 
 * @param {Object} req The data which the user whishes to update
 * @param {Object} res The result sent back to client
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body A valid user object
 * 
 * @throws {Error} The user provides information that is not accepted when updating their profile.
 * @throws {Error} The user attempts to update his username but it is already in use.
 * @throws {Error} The server fails to update the user profile.
 */

const updateUser = async (req, res) =>
{
    const db = await mongo()
    const updateUserResponse = await db
        .collection(constants.usersCollection)
        .findOneAndUpdate(
            {
                _id: req.userid
            },
            {
                $set: req.body
            },
            {
                returnDocument: 'after' // Return the updated user object
            })

    await publishToEmailQueue(constants.emailQueue, updateUserResponse.value.userEmail + '|' + 'Profile Update' + '|' + 'Your profile on Commmunity API has been updated')

    res.status(200).send(updateUserResponse.value)
}

const updateUserBackground = async (req, res) =>
{
    const firebaseBucket = getStorage().bucket()
    const filename = constants.usersBackgroundsStorage + req.userid + path.extname(req.file.originalname) // Set filename for group picture to user uid
    const file = firebaseBucket.file(filename)

    const passthroughStream = new stream.PassThrough()
    passthroughStream.write(req.file.buffer)
    passthroughStream.end()

    passthroughStream.pipe(file.createWriteStream({ public: true })) // Pipe the write stream and wait for a finish or error event
        .on('finish', async () => 
        {
            const db = await mongo()
            const userBackgroundUpdateResponse = await db // Map the uploaded picture to the user object
                .collection(constants.usersCollection)
                .findOneAndUpdate(
                    {
                        _id: req.userid
                    },
                    {
                        $set: { userBackground: file.metadata.mediaLink }
                    },
                    {
                        returnDocument: 'after' // Return the updated user object
                    })

            sendMail("mmalkani.mm@gmail.com" , "Profile update" , "Alert!! Your profile has been updated.")
            res.status(200).send(userBackgroundUpdateResponse.value) // Send the final user object back as a reponse
        })
        .on('error', async () => 
        {
            res.status(500).send('Server error')
        })
}

/**
 * The sendGroupJoinRequest function handles sending a request to join a new group.
 * When a request is made to this endpoint, it checks if the group id, provided by the user is valid.
 * If the group id is invalid, it sends a response message saying the user has not provided a valid id.
 * If the group id is valid, it then checks to see it the group exists.
 * If the group does not exist, it then sends a response that the group does not exist.
 * If the group exists, it checks if the user is already a part of the group they are attempting to send a join request to.
 * If the user is already a part of the group, it sends a response message that the join request could not be sent.
 * If the user is not a part of the group, it then adds the user's id to the request pending list and sends a response that a join request has been sent.
 * 
 * @param {Object} req The id of the group they wish to join
 * @param {Object} res The result sent back to the client
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body.groupId The id of the group that the user is requesting to join
 * 
 * @throws {Error} If there is an error while processing the request
 * @throws {Error} If the specified group cannot be found in the database
 * @throws {Error} If the join request could not be sent
 */

const sendGroupJoinRequest = async (req, res) =>
{
    const { groupId } = req.body

    const db = await mongo()
    const groupDataResponse = await db
        .collection(constants.groupsCollection)
        .find(
            {
                _id: new ObjectId(groupId)

            }).toArray()

    if (groupDataResponse.length == 0)
    {
        res.status(404).send('Group not found')
    }
    else
    {
        const memberRequestsResponse = await db
            .collection(constants.groupsCollection)
            .updateOne(
                {
                    _id: new ObjectId(groupId)
                },
                {
                    $addToSet:
                    {
                        memberRequests: req.userid
                    }
                })

        if (memberRequestsResponse.acknowledged = true)
        {
            if (memberRequestsResponse.matchedCount == 0)
            {
                res.status(404).send('Group not found')
            }
            if (memberRequestsResponse.modifiedCount == 0)
            {
                res.status(404).send('Could not send join request')
            }
            if (memberRequestsResponse.matchedCount != 0 && groupDataResponse.length != 0)
            {
                res.status(200).send('Join request sent')
            }
            else
            {
                res.status(500).send('Server error')
            }
        }
    }
}

/**
 * The cancelGroupJoinRequest function handles sending a request to cancel the join request to a new group.
 * When a request is made to this endpoint, it checks if the group id, provided by the user is valid.
 * If the group id is invalid, it sends a response message saying the user has not provided a valid id.
 * If the group id is valid, it then checks to see it the group exists.
 * If the group does not exist, it then sends a response that the group does not exist.
 * If the group exists, it checks if the user is already a part of the group they are attempting to send a cancel request to.
 * If the user has not sent a join request, it sends a response message that the cancel request could not be sent.
 * If the user has sent a join request, it cancels the join request and sends a response that a join request has been cancelled.
 * 
 * @param {Object} req The id of the group they wish to cancel their request for
 * @param {Object} res The result sent back to client
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body.groupId The id of the group that the user is canceling the join request for
 * 
 * @throws {Error} If there is an error while processing the request
 * @throws {Error} If the specified group cannot be found in the database
 * @throws {Error} If the join request could not be canceled
 */

const cancelGroupJoinRequest = async (req, res) =>
{
    const { groupId } = req.body

    const db = await mongo()
    const groupDataResponse = await db
        .collection(constants.groupsCollection)
        .find(
            {
                _id: new ObjectId(groupId)

            }).toArray()

    if (groupDataResponse.length == 0)
    {
        res.status(404).send('Group not found')
    }
    else
    {
        const memberRequestsResponse = await db
            .collection(constants.groupsCollection)
            .updateOne(
                {
                    _id: new ObjectId(groupId)
                },
                {
                    $pull:
                    {
                        memberRequests: req.userid
                    }
                })

        if (memberRequestsResponse.acknowledged = true)
        {
            if (memberRequestsResponse.matchedCount == 0)
            {
                res.status(404).send('Group not found')
            }
            if (memberRequestsResponse.modifiedCount == 0)
            {
                res.status(404).send('Could not cancel join request')
            }
            if (memberRequestsResponse.matchedCount != 0 && groupDataResponse.length != 0)
            {
                res.status(200).send('Join request canceled')
            }
            else
            {
                res.status(500).send('Server error')
            }
        }
    }
}

/**
 * Leaves a group for the user
 * 
 * @param {Object} req The groupid of the group the user wishes to leave
 * @param {Object} res The result that the server has succeeded or failed in making the user exit the group.
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body.groupId The id of the group that the user wants to leave
 * 
 * @throws {Error} If there is an error while processing the request
 * @throws {Error} If the specified group cannot be found in the database
 * @throws {Error} If the leave request could not be processed
 */

const leaveGroup = async (req, res) =>
{
    const { groupId } = req.body

    const db = await mongo()
    const groupDataResponse = await db
        .collection(constants.groupsCollection)
        .find(
            {
                _id: new ObjectId(groupId)

            }).toArray()

    if (groupDataResponse.length == 0)
    {
        res.status(404).send('Group not found')
    }
    else
    {
        const membersDataResponse = await db
            .collection(constants.groupsCollection)
            .updateOne(
                {
                    _id: new ObjectId(groupId)
                },
                {
                    $pull:
                    {
                        members: req.userid
                    }
                })

        if (membersDataResponse.acknowledged == true)
        {
            if (membersDataResponse.matchedCount == 0)
            {
                res.status(404).send('Group not found')
            }
            if (membersDataResponse.modifiedCount == 0)
            {
                res.status(404).send('Could not leave group. User may not be a part of the group')
            }
            if (membersDataResponse.matchedCount == 1 && groupDataResponse.length == 1)
            {
                res.status(200).send('Group left')
            }
            else
            {
                res.status(500).send('Server error')
            }
        }
    }
}

/**
 * The followUser function handles following another user.
 * When a request is sent to this endpoint, it checks the user's following list.
 * If the user is already following the second user, it sends a response that they are already following that user.
 * If the user is not following the second, it then adds them as a follower and it also adds their user id to the second user's list of followers.
 * 
 * @param {Object} req The userid of the user they wish to follow
 * @param {Object} res The result sent back to the client
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body.userId - The id of the user to follow.
 * 
 * @throws {Error} If the follow request could not be processed
 * @throws {Error} If the user is already following the user they are attempting to follow
 */

const followUser = async (req, res) =>
{
    const { userId } = req.body
    const db = await mongo()

    const followUserResponse = await db
        .collection(constants.usersCollection)
        .updateOne(
            {
                _id: userId
            },
            {
                $addToSet:
                {
                    followers: req.userid
                }
            })

    const followingUserResponse = await db
        .collection(constants.usersCollection)
        .updateOne(
            {
                _id: req.userid
            },
            {
                $addToSet:
                {
                    following: userId
                }
            })

    if (followUserResponse.modifiedCount == 1 && followingUserResponse.modifiedCount == 1)
    {
        res.status(200).send('Followed user')
    }
    else if (followUserResponse.matchedCount == 1 && followUserResponse.modifiedCount == 0)
    {
        res.status(403).send('Already Following the user')
    }
    else
    {
        res.status(403).send('Could not follow user')
    }
}

/**
 * The unFollowUSer function handles unfollowing another user.
 * When a request is made to this endpoit, it checks the user's following list.
 * If the user is not following the second user, it sends a response message that the user cannot unfollow someone they are not following.
 * If the user is following the second user, it removes them as a follower and removes them from the second user's followers list.
 * 
 * @param {Object} req The userid of the user they wish to unfollow.
 * @param {Object} res The result sent back to the client.
 * @param {string} req.userid The id of the user retrieved from the auth token
 * @param {string} req.body.userId - The id of the user to unfollow.
 * 
 * @throws {Error} If the unfollow request could not be processed
 */

const unfollowUser = async (req, res) =>
{
    const { userId } = req.body

    const db = await mongo()
    const unfollowUserResponse = await db
        .collection(constants.usersCollection)
        .updateOne(
            {
                _id: userId
            },
            {
                $pull:
                {
                    followers: req.userid
                }
            })

    if (unfollowUserResponse.modifiedCount == 1)
    {
        res.status(200).send('Unfollowed user')
    }
    else if (unfollowUserResponse.matchedCount == 1 && unfollowUserResponse.modifiedCount == 0)
    {
        res.status(403).send('You cannot unfollow a user you are not following')
    }
    else
    {
        res.status(403).send('Could not follow user')
    }
}

const getUserFeed = async (req, res) =>
{
    const db = await mongo()

    const userResponse = await db
        .collection(constants.usersCollection)
        .find(
            {
                _id: req.params.userid

            }).toArray()

    if (req.params.sort == 'byLikes')
    {
        const userFeedGroupsandFollowingResponse = await db
            .collection(constants.postsCollection)
            .aggregate(
                [
                    {
                        $match:
                        {
                            $or:
                                [
                                    {
                                        inGroup:
                                        {
                                            $in: userResponse[0].userGroups
                                        },
                                        visible: 'true'
                                    },
                                    {
                                        postAuthor:
                                        {
                                            $in: userResponse[0].following
                                        },
                                        visible: 'true'
                                    }
                                ]
                        }
                    },
                    {
                        $sort:
                        {
                            likes : -1
                        }
                    },
                    {
                        $skip : 10 * req.params.page
                    },
                    {
                        $limit : 10
                    }

                ]).toArray()

        res.status(200).send(userFeedGroupsandFollowingResponse)

    }
    else if (req.params.sort == 'byCreated')
    {
        const userFeedGroupsandFollowingResponse = await db
            .collection(constants.postsCollection)
            .aggregate(
                [
                    {
                        $match:
                        {
                            $or:
                                [
                                    {
                                        inGroup:
                                        {
                                            $in: userResponse[0].userGroups
                                        },
                                        visible: 'true'
                                    },
                                    {
                                        postAuthor:
                                        {
                                            $in: userResponse[0].following
                                        },
                                        visible: 'true'
                                    }
                                ]
                        }
                    },
                    {
                        $sort:
                        {
                            createdAt: -1
                        }
                    },
                    {
                        $skip: 10 * req.params.page
                    },
                    {
                        $limit : 10
                    }

                ]).toArray()

        res.status(200).send(userFeedGroupsandFollowingResponse)
    }
    else if (req.params.sort == 'byUpdated')
    {
        const userFeedGroupsandFollowingResponse = await db
            .collection(constants.postsCollection)
            .aggregate(
                [
                    {
                        $match:
                        {
                            $or:
                                [
                                    {
                                        inGroup:
                                        {
                                            $in: userResponse[0].userGroups
                                        },
                                        visible: 'true'
                                    },
                                    {
                                        postAuthor:
                                        {
                                            $in: userResponse[0].following
                                        },
                                        visible: 'true'
                                    }
                                ]
                        }
                    },
                    {
                        $sort:
                        {
                            updatedAt: -1
                        }
                    },
                    {
                        $skip: 10 * req.params.page
                    },
                    {
                        $limit : 10
                    }

                ]).toArray()

        res.status(200).send(userFeedGroupsandFollowingResponse)
    }
    else
    {
        res.status(403).send('Invalid sorting')
    }
}

export { createUser, getUser, getSelf, updateUser, updateUserBackground, sendGroupJoinRequest, cancelGroupJoinRequest, leaveGroup, followUser, unfollowUser, getUserFeed }
