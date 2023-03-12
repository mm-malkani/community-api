import { MongoClient } from 'mongodb'
const uri = 'mongodb+srv://mohammadm:12Muhammad34@db.z45grtu.mongodb.net'

let connPoolPromise = null;

export default () =>
{
	if (connPoolPromise) return connPoolPromise;

	connPoolPromise = new Promise(function (resolve, reject)
	{
		const conn = new MongoClient(uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		conn
			.connect()
			.then(function ()
			{
				return resolve(conn.db('db'));
			})
			.catch(err =>
			{
				console.log(err);
				reject(err);
			});

	});

	return connPoolPromise;
}
