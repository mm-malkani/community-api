import amqp from 'amqplib/callback_api.js'
import * as constants from '../constants/constants.js'

let currencyChannel, emailChannel = null

amqp.connect(constants.mqConnectionUrl, function(error0, connection) 
{
    if (error0)
    {
        throw error0;
    }

    connection.createChannel(function(error1, channel) 
    {
        if (error1) 
        {
            throw error1;
        }

        channel.assertQueue(constants.currencyQueue, 
        {
            durable: false
        })

        currencyChannel = channel
        console.log('Created currency channel')

    })

    connection.createChannel(function(error1, channel) 
    {
        if (error1) 
        {
            throw error1;
        }

        channel.assertQueue(constants.emailQueue, 
        {
            durable: false
        })

        emailChannel = channel
        console.log('Created email channel')

    })
    
   
})

export const publishToCurrencyQueue = async (queueName, message) =>
{
    currencyChannel.sendToQueue(queueName, Buffer.from(message))
}

export const publishToEmailQueue = async (queueName, message) =>
{
    emailChannel.sendToQueue(queueName, Buffer.from(message))
}

process.on('exit', (code) =>
{
    currencyChannel.close()
    emailChannel.close()
    console.log('Closing currency mq channel')
})
