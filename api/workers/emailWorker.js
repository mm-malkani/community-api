import mongo from '../utils/mongoUtil.js'
import amqp from  'amqplib/callback_api.js'
import * as constants from '../constants/constants.js'
import nodeMailer from 'nodemailer'

amqp.connect(constants.mqConnectionUrl, function(err, conn)
{
    conn.createChannel(function (err, ch) 
    {
        ch.consume(constants.emailQueue, async function (data) 
        {            
            const messageData = data.content.toString().split('|')
            console.log('Email message received')

            sendMail(messageData[0], messageData[1], messageData[2])

            ch.ack(data)

        }, 
        { noAck: false })
    })
})

async function sendMail(userEmail, mailSubject, mailMessage)
{
    let transporter = nodeMailer.createTransport
    ({
        service: "gmail",
        auth: 
        {
            user: "mmalkani.mm@gmail.com",
            pass: "mjhdkkrmsscyapcr"
        }
    })

    let info = await transporter.sendMail
    ({
        from: "mmalkani.mm@gmail.com",
        to : userEmail,
        subject: mailSubject,
        text : mailMessage
    })

    console.log(info)

}
