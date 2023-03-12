import mongo from '../utils/mongoUtil.js'
import amqp from  'amqplib/callback_api.js'
import * as constants from '../constants/constants.js'

amqp.connect(constants.mqConnectionUrl, function(err, conn)
{
    conn.createChannel(function (err, ch) 
    {
        ch.consume(constants.currencyQueue, async function (data) 
        {            
            const messageData = data.content.toString().split('|')
            await issueCurrency(messageData[0], messageData[1])

            ch.ack(data)

        }, 
        { noAck: false })
    })
})

async function issueCurrency(userId, action)
{
    var currencyToBeIssued
    var actionToBeIssuedFor

    switch (action)
    {
        case 'createPost':
            actionToBeIssuedFor = "Post created at " + new Date()
            currencyToBeIssued = 5
            break

        case 'createGroup':
            actionToBeIssuedFor = "Group created at " + new Date()
            currencyToBeIssued = 3
            break

        case 'createComment':
            actionToBeIssuedFor = "Comment created at " + new Date()
            currencyToBeIssued = 2
            break

        case 'postLiked':
            actionToBeIssuedFor = "Post liked at " + new Date()
            currencyToBeIssued = 1
            break

        case 'commentLiked':
            actionToBeIssuedFor = "Comment liked at " + new Date()
            currencyToBeIssued = 1
            break

        case 'default':
            currencyToBeIssued = 0
            break
    }

    if (currencyToBeIssued != 0)
    {
        const db = await mongo()
        const data = await db
            .collection(constants.usersCollection)
            .updateOne(
                { 
                    _id: userId 
                }, 
                { 
                    $addToSet: 
                    { 
                        points: 
                        { 
                            action: actionToBeIssuedFor, 
                            amount: currencyToBeIssued 
                        } 
                    } 
                })

        console.log(data)

        if(data.modifiedCount == 1)
        {
            return true
        }
        else
        {
            return false
        }
    }
    else
    {
        return false
    }
}