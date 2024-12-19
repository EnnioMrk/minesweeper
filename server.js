import express from 'express';
import bodyParser from 'body-parser';
import { Database } from 'bun:sqlite';

const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = new Database('highscores.db');

db.run(`
    CREATE TABLE IF NOT EXISTS highscores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        speed INTEGER,
        columns INTEGER,
        rows INTEGER,
        mines INTEGER,
        score INTEGER,
        username TEXT,
        date TEXT
    )
`);

function calculateScore(speed, columns, rows, mines) {
    return Math.floor(((columns * rows * 1000) / (speed + mines)) * 10);
}

app.post('/highscore', (req, res) => {
    const { speed, columns, rows, mines, username } = req.body;

    if (
        typeof speed !== 'number' ||
        typeof columns !== 'number' ||
        typeof rows !== 'number' ||
        typeof mines !== 'number'
    ) {
        return res.status(400).send('Invalid input');
    }

    const score = calculateScore(speed, columns, rows, mines);

    const stmt = db.prepare(`
        INSERT INTO highscores (speed, columns, rows, mines, score, username, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        speed,
        columns,
        rows,
        mines,
        score,
        username || 'Anonymous',
        new Date().toISOString()
    );

    res.status(201).send('High score added');
});

app.get('/highscores', (req, res) => {
    const stmt = db.prepare('SELECT * FROM highscores');
    const highScores = stmt.all();
    res.json(highScores);
});

// Serve static files from the public directory
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});