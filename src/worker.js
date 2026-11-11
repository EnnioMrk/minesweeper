const BASE_SCORE = 1000;
const MAX_ROWS_OR_COLUMNS = 100;
const MAX_USERNAME_LENGTH = 24;
const HIGHSCORE_LIMIT = 100;

function calculateScore(speed, columns, rows, mines) {
    const boardSize = columns * rows;
    const mineDensity = mines / boardSize;

    const boardFactor = Math.pow(boardSize / 64, 1.5);
    const mineFactor = Math.pow(0.7, (0.3 - mineDensity) * 10);
    const speedFactor = Math.max(0, 1 - speed / 5000);

    return Math.round(BASE_SCORE * boardFactor * mineFactor * (1 + speedFactor));
}

function json(data, init = {}) {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            ...(init.headers || {}),
        },
    });
}

function isWholeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

async function addHighscore(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    if (!body || typeof body !== "object") {
        return new Response("Invalid input", { status: 400 });
    }

    const { speed, columns, rows, mines } = body;

    if (
        !isWholeNumber(speed) ||
        !isWholeNumber(columns) ||
        !isWholeNumber(rows) ||
        !isWholeNumber(mines)
    ) {
        return new Response("Invalid input", { status: 400 });
    }

    if (
        columns < 2 ||
        rows < 2 ||
        columns > MAX_ROWS_OR_COLUMNS ||
        rows > MAX_ROWS_OR_COLUMNS ||
        mines < 1 ||
        mines >= columns * rows ||
        speed > 24 * 60 * 60 * 1000
    ) {
        return new Response("Invalid input", { status: 400 });
    }

    const username =
        typeof body.username === "string"
            ? body.username.trim().slice(0, MAX_USERNAME_LENGTH)
            : "";

    const score = calculateScore(speed, columns, rows, mines);

    await env.DB.prepare(
        `INSERT INTO highscores (speed, columns, rows, mines, score, username, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            Math.round(speed),
            Math.round(columns),
            Math.round(rows),
            Math.round(mines),
            score,
            username || "Anonymous",
            new Date().toISOString()
        )
        .run();

    return new Response("High score added", {
        status: 201,
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}

async function listHighscores(env) {
    const { results } = await env.DB.prepare(
        `SELECT id, speed, columns, rows, mines, score, username, date
         FROM highscores
         ORDER BY score DESC, id ASC
         LIMIT ?`
    )
        .bind(HIGHSCORE_LIMIT)
        .all();

    return json(results ?? []);
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (pathname === "/highscores") {
            if (request.method !== "GET") {
                return new Response("Method not allowed", {
                    status: 405,
                    headers: { allow: "GET" },
                });
            }
            return listHighscores(env);
        }

        if (pathname === "/highscore") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", {
                    status: 405,
                    headers: { allow: "POST" },
                });
            }
            return addHighscore(request, env);
        }

        return env.ASSETS.fetch(request);
    },
};
