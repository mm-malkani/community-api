import nodeMailer from 'nodemailer'
import admin from '../utils/firebaseUtil.js'

async function sendVerificationMail(userEmail)
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

    try
    {
        try {
            admin.auth().generateEmailVerificationLink(userEmail)
            .then(async(emailLink) => 
            {
                await transporter.sendMail(
                    {
                    from: "mmalkani.mm@gmail.com",
                    to: userEmail,
                    subject: "Email Verification for " + userEmail,
                    html: `Hello, to verify your email please, <a href="${emailLink}"> click here </a>`
                })
            })
            .catch(error => 
            {
                console.log(error)
            })
        } 
        catch (error) 
        {
            console.log(error)  
        }


    }
    catch (error) 
    {
        console.log(error)  
    }

}


 export { sendVerificationMail }