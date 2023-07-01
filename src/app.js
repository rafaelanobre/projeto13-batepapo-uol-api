import express from "express";
import cors from 'cors';
import { MongoClient } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());
configDotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.listen(5000);