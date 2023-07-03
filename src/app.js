import express from "express";
import cors from 'cors';
import { MongoClient, ObjectId } from "mongodb";
import joi from 'joi'
import dotenv from 'dotenv';
import DayJS from 'dayjs';
import 'dayjs/locale/pt-br.js';
import { stripHtml } from "string-strip-html";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

//PARTICIPANT ROUTES
app.post('/participants', (req,res) =>{
    const {name} = req.body;
    const sanitizedName = stripHtml(name).result;

    const validation = joi.string().required().validate(sanitizedName.trim(), { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }


    db.collection("participants").findOne({ name: sanitizedName })
    .then(participant => {
        if (participant) {
            return res.status(409).send("Nome já em uso.");
        }

        db.collection("participants").insertOne({
            name: sanitizedName.trim(),
            lastStatus: Date.now()
        })
        .then(() => {
            const message = {
                from: sanitizedName.trim(),
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: DayJS().locale('pt-br').format('HH:mm:ss')
            };

            db.collection("messages").insertOne(message)
                .then(() => res.sendStatus(201))
                .catch(err => res.status(500).send(err.message));
        })
            .catch(err => res.status(500).send(err.message))
    })
    .catch(err => res.status(500).send(err.message))

});

app.get('/participants', (req,res)=>{
    const users = db.collection("participants").find().toArray()
    .then(users => res.send(users))
    .catch(err => res.status(500).send(err.message))
});

//MESSAGES ROUTES

app.post('/messages', (req,res)=>{
    const {to, text, type} = req.body;
    const from = req.headers.user;
    const sanitizedText = stripHtml(text).result;

    const schema = joi.object({
        from: joi.string().required(),
        to: joi.string().required().min(1),
        text: joi.string().required().min(1),
        type: joi.string().valid('message', 'private_message').required(),
        time: joi.any()
    });

    const message = {
        from,
        to,
        text: sanitizedText.trim(),
        type,
        time: DayJS().locale('pt-br').format('HH:mm:ss')
    }

    const validation = schema.validate(message, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    db.collection("participants").findOne({ name: from })
    .then(participant => {
        if (!participant) {
            return res.status(422).send("Participante não existente.");
        }

        db.collection("messages").insertOne(message)
            .then(() => res.sendStatus(201))
            .catch(err => res.status(500).send(err.message))
    })
    .catch(err => res.status(500).send(err.message))

});

app.get('/messages', (req, res) => {
    const messagesLimit = parseInt(req.query.limit);
    const {user} = req.headers;

    const { error, value } = joi.number().integer().min(1).validate(req.query.limit);


    let messagesQuery;

    let queryParams = {
        $or: [
            { to: user },
            { from: user },
            { to: 'Todos' }
        ],
    };

    if (messagesLimit !== undefined) {
        if (error) {
            return res.status(422).send('Limite de mensagens inválido.');
        }
        messagesQuery = db.collection('messages').find(queryParams).limit(messagesLimit);
    } else {
        messagesQuery = db.collection('messages').find(queryParams);
    }

    if (messagesQuery) {
        messagesQuery.toArray()
            .then((messages) => {
                res.status(200).send(messages);
            })
            .catch((error) => {
                res.status(500).send(error.message);
            });
    } else {
        res.status(500).send('Ocorreu um erro ao obter as mensagens.');
    }
});

app.delete('/messages/:id', (req, res) => {
    const { User } = req.headers;
    const { id } = req.params;

    db.collection('messages').findOne({ _id: new ObjectId(id) })
        .then((message) => {
            if (!message) {
                return res.sendStatus(404);
            }
    
            if (message.from !== User) {
                return res.sendStatus(401);
            }

            db.collection('messages').deleteOne({ _id: new ObjectId(id) })
                .then(() => {
                    res.status(200).send("Mensagem deletada.");
                })
                .catch((err) => {
                    res.status(500).send(err.message);
                });
        })
        .catch((err) => {
            res.status(500).send(err.message);
        });
});

//STATUS ROUTE
app.post('/status', (req,res)=>{
    const {user} = req.headers

    if(!user){
        return res.sendStatus(404)
    }

    db.collection("participants").findOne({ name: user })
    .then(participant => {
        if (!participant) {
            return res.sendStatus(404);
        }

        db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
            .then(() => {
                res.sendStatus(200);
            })
            .catch((err) => {
                res.status(500).send(err.message);
            });
    })
    .catch(err => res.status(500).send(err.message))
});

//INATIVE USERS CLEANUP

function removeInactiveParticipants() {
    db.collection("participants").find({ lastStatus: { $lt: Date.now() - 10000 } }).toArray()
        .then((participants) => {
            participants.forEach((participant) => {
                db.collection("participants").deleteOne({ _id: new ObjectId(id) });

                const message = {
                    from: participant.name,
                    to: "Todos",
                    text: 'sai da sala...',
                    type: "status",
                    time: DayJS().locale("pt-br").format("HH:mm:ss"),
                };

                db.collection("messages").insertOne(message);
            });
        })
        .catch((err) => {
            console.error("Erro ao remover usuários inativos:", err);
        });
}

setInterval(removeInactiveParticipants, 15000);


app.listen(5000);