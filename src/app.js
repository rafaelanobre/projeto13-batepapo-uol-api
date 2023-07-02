import express from "express";
import cors from 'cors';
import { MongoClient } from "mongodb";
import joi from 'joi'

const app = express();
app.use(cors());
app.use(express.json());
configDotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

//PARTICIPANT ROUTES
app.post('/participants', (req,res) =>{
    const {name} = req.body;

    const validation = joi.string().required().validate(name, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }
    if (db.participants.find({ name: name}) ){
        return res.status(409).send("Nome já em uso.")
    }

    db.collection("participants").insertOne({
		name: name,
		lastStatus: Date.now()
	})
        .then(participants => res.sendStatus(201))
	    .catch(err => res.status(500).send(err.message))


});

app.get('participants', (req,res)=>{
    const users = db.collection("participants").find().toArray()
    .then(users => res.send(users))
    .catch(err => res.status(500).send(err.message))
});

//MESSAGES ROUTES


app.listen(5000);