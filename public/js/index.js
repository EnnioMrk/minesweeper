/*global cvh_game, cvh_object_manager, assetLoader, uih_manager, Swal, timer */
/*exported pageBack */
let om;

let sprites_data = [
    { url: 'assets/sprites_dungeon.png', px: 194 },
    { url: 'assets/sprites_default.png', px: 16 },
];
let sprites_num = 1;

//(async () => {
// #region config
let rows_amt = 16;
let cols_amt = 16;
let mines_min = 15;
let mines_max = 25;
let mines_amt;
let mines_distribution_factor = 0.5; //the bigger the number, the more spread out the mines
let poisson_disk_sampling_max_attempts = 1000;
let mines_safe_radius = 1;

let board_width = 800; // Specify board width in pixels
let max_board_height = 400; // Specify maximum board height in pixels
let cell_size = sprites_data[sprites_num].px;
let cell_padding = 1;
let cell_magnify = board_width / (cols_amt * (cell_size + cell_padding));
let board_height = rows_amt * (cell_size + cell_padding) * cell_magnify;
let display_board_width = board_width;
let display_board_height = board_height;

let speed_timer = new timer();

function recalculateMagnification() {
    cell_magnify = board_width / (cols_amt * (cell_size + cell_padding));
    board_height = rows_amt * (cell_size + cell_padding) * cell_magnify;
    display_board_width = board_width;
    display_board_height = board_height;
    if (board_height > max_board_height) {
        display_board_height = max_board_height;
        cell_magnify =
            display_board_height / (rows_amt * (cell_size + cell_padding));
        display_board_width =
            cols_amt * (cell_size + cell_padding) * cell_magnify;
    }
}

// Add resize listener after game creation
window.addEventListener('resize', recalculateMagnification);

function getCellPosition(i, j) {
    return {
        x: () =>
            board.x +
            j * (cell_size + cell_padding) * cell_magnify +
            cell_padding,
        y: () =>
            board.y +
            i * (cell_size + cell_padding) * cell_magnify +
            cell_padding,
    };
}

function createCellSprite(i, j, clickHandler) {
    const position = getCellPosition(i, j);
    return om.create.image(position.x, position.y, a_covered, {
        magnify: () => cell_magnify,
        z: 1,
        onClick: () => clickHandler(false),
        onRightClick: () => clickHandler(true),
    });
}
// #endregion
// #region setup
const gameCanvas = document.getElementById('game');
const gameWrapper = document.getElementById('gameWrapper');
const highscoresWrapper = document.getElementById('highscoresWrapper');
const heading = document.getElementById('heading');
const mainWrapper = document.getElementById('mainWrapper');

let game = new cvh_game(gameCanvas, [window.innerWidth, window.innerHeight], {
    backgroundColor: 'rgba(255, 255, 255, 0)',
});

om = new cvh_object_manager(game);
//game.start();

om.createClickListener();

let sprites_blob = await fetch(sprites_data[sprites_num].url).then((response) =>
    response.blob()
);
let asset_loader = new assetLoader(sprites_blob, sprites_data[sprites_num].px);
console.log(asset_loader);
await asset_loader.loadAll();

let a_numbers = asset_loader.assets.slice(0, 8);
let [a_uncovered, a_covered, a_bomb, a_flag] = asset_loader.assets.slice(8, 12);

let rows = new Array();
let mines_locations = new Array();

let uim = new uih_manager(game, mainWrapper);
await uim.get_all_templates();
const ui_config_file = await fetch('/assets/ui.json');
const ui_config = await ui_config_file.json();
uim.register_page({
    wrapper: gameWrapper,
    id: 'Game',
    onload: () => {
        game.start();
        speed_timer.show();
    },
    offload: () => {
        game.stop();
        speed_timer.stop();
        speed_timer.hide();
    },
});
uim.register_page({
    wrapper: highscoresWrapper,
    id: 'Highscores',
    onload: () => {
        heading.textContent = 'Highscores';
    },
    offload: () => {
        heading.textContent = 'Minesweeper';
    },
});
await uim.load_ui(ui_config);
uim.register_var_watcher('rows', (v, value) => {
    console.log('Rows changed to: ' + value);
    rows_amt = parseInt(value);
    recalculateMagnification();
    //ms_empty_init();
});
uim.register_var_watcher('cols', (v, value) => {
    console.log('Cols changed to: ' + value);
    cols_amt = parseInt(value);
    recalculateMagnification();
    //ms_empty_init();
});
uim.set_var('rows', rows_amt);
uim.set_var('cols', cols_amt);
uim.register_var_watcher('mines', (v, value) => {
    switch (v) {
        case 'from':
            console.log('Mines min changed to: ' + value);
            mines_min = value;
            break;
        case 'to':
            console.log('Mines max changed to: ' + value);
            mines_max = value;
            break;
    }
});
uim.set_var('mines', 'from', mines_min);
uim.set_var('mines', 'to', mines_max);

// #endregion
// #region init
function ms_mine_in_corner(x, y) {
    //check if mine is in corner or adjacent to corner(diagonal is also adjacent)
    if (
        (x == 0 && y == 0) ||
        (x == 0 && y == rows_amt - 1) ||
        (x == cols_amt - 1 && y == 0) ||
        (x == cols_amt - 1 && y == rows_amt - 1) ||
        (x == 0 && y == 1) ||
        (x == 1 && y == 0) ||
        (x == 0 && y == rows_amt - 2) ||
        (x == 1 && y == rows_amt - 1) ||
        (x == cols_amt - 1 && y == 1) ||
        (x == cols_amt - 2 && y == 0) ||
        (x == cols_amt - 1 && y == rows_amt - 2) ||
        (x == cols_amt - 2 && y == rows_amt - 1) ||
        (x == 1 && y == 1) ||
        (x == 1 && y == rows_amt - 2) ||
        (x == cols_amt - 2 && y == 1) ||
        (x == cols_amt - 2 && y == rows_amt - 2)
    )
        return true;
    return false;
}
function ms_mine_valid(x, y, i, j) {
    //check if mine is in safe radius around first click
    if (
        Math.abs(x - i) <= mines_safe_radius &&
        Math.abs(y - j) <= mines_safe_radius
    )
        return false;
    if (!ms_mine_in_corner(x, y)) return true;
    return false;
}
// eslint-disable-next-line no-unused-vars
function ms_mines_generate(i, j) {
    mines_min = Math.floor((mines_min / 100) * (cols_amt * rows_amt));
    mines_max = Math.floor((mines_max / 100) * (cols_amt * rows_amt));
    mines_amt = Math.floor(Math.random() * (mines_max - mines_min)) + mines_min;
    while (mines_locations.length < mines_amt) {
        let x = Math.floor(Math.random() * cols_amt);
        let y = Math.floor(Math.random() * rows_amt);
        if (x == i && y == j) continue;
        if (!mines_locations.some((m) => m[0] == x && m[1] == y))
            mines_locations.push([x, y]);
    }
}

function ms_mines_generate_poisson_disk_sampling(i, j) {
    let mines_min_number = Math.floor(
        (mines_min / 100) * (cols_amt * rows_amt)
    );
    let mines_max_number = Math.floor(
        (mines_max / 100) * (cols_amt * rows_amt)
    );
    console.log(`Generating ${mines_min_number} to ${mines_max_number} mines`);
    mines_amt =
        Math.floor(Math.random() * (mines_max_number - mines_min_number)) +
        mines_min_number;
    // Calculate minimum mine separation based on grid size and distribution factor
    const minDistance =
        Math.min(cols_amt, rows_amt) /
        Math.pow(mines_amt, 1 / mines_distribution_factor);
    let attempts = 0;

    while (
        mines_locations.length < mines_amt &&
        attempts < poisson_disk_sampling_max_attempts * mines_amt
    ) {
        // First mine is completely random
        if (mines_locations.length === 0) {
            mines_locations.push([
                Math.floor(Math.random() * cols_amt),
                Math.floor(Math.random() * rows_amt),
            ]);
            continue;
        }

        // Generate candidate mine
        const candidate = [
            Math.floor(Math.random() * cols_amt),
            Math.floor(Math.random() * rows_amt),
        ];

        // Check distance from existing mines
        const isValid = mines_locations.every((mine) => {
            const distance = Math.sqrt(
                Math.pow(candidate[0] - mine[0], 2) +
                    Math.pow(candidate[1] - mine[1], 2)
            );
            return distance >= minDistance;
        });

        if (isValid && ms_mine_valid(candidate[0], candidate[1], i, j)) {
            mines_locations.push(candidate);
        }

        attempts++;
    }

    // If we couldn't generate enough mines, fill with random mines
    while (mines_locations.length < mines_amt) {
        mines_locations.push([
            Math.floor(Math.random() * cols_amt),
            Math.floor(Math.random() * rows_amt),
        ]);
    }

    //filter out mines with radius around i, j
    mines_locations = mines_locations.filter((m) => {
        return (
            Math.abs(m[0] - j) > mines_safe_radius ||
            Math.abs(m[1] - i) > mines_safe_radius
        );
    });

    console.log(
        `Generated ${mines_locations.length} mines, (min: ${mines_min_number}, max: ${mines_max_number}, wanted: ${mines_amt})`
    );
}

function ms_cells_rows_generate() {
    rows = [];
    for (let i = 0; i < rows_amt; i++) {
        let row = new Array();
        for (let j = 0; j < cols_amt; j++) {
            let cell = {
                x: j,
                y: i,
                mine: mines_locations.some((m) => m[0] == j && m[1] == i),
                flagged: false,
                uncovered: false,
                neighbors: 0,
            };
            row.push(cell);
        }
        rows.push(row);
    }
}

function ms_cells_neighbors_calculate() {
    rows.forEach((row, i) => {
        row.forEach((cell, j) => {
            if (cell.mine) return;
            let neighbors = 0;
            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y++) {
                    if (x == 0 && y == 0) continue;
                    if (
                        i + x < 0 ||
                        i + x >= rows_amt ||
                        j + y < 0 ||
                        j + y >= cols_amt
                    )
                        continue;
                    if (rows[i + x][j + y].mine) neighbors++;
                }
            }
            cell.neighbors = neighbors;
        });
    });
}

let cells = new Array();
let uncovered_cells = 0;

let boardFill = false; //'#ccc';
let boardBorder = false; //'#eee';
let board = om.create.rectangle(
    () => window.innerWidth / 2 - display_board_width / 2,
    () => window.innerHeight / 2 - display_board_height / 2,
    () => display_board_width,
    () => display_board_height,
    { fill: boardFill, border: { color: boardBorder } }
);

function ms_cells_generate(x, y) {
    rows.forEach((row, i) => {
        row.forEach((cell, j) => {
            let cell_sprite = createCellSprite(i, j, (rightClick) =>
                cell_on_click(cell, cell_sprite, i, j, rightClick)
            );
            cell_sprite.cell = cell;
            cells[j] ? (cells[j][i] = cell_sprite) : (cells[j] = [cell_sprite]);
        });
    });
    cell_on_click(rows[x][y], cells[y][x], x, y, false);
}

function ms_empty_init() {
    console.log(`Initializing empty board with ${rows_amt}x${cols_amt} cells`);
    om.clear('image');
    speed_timer.reset();
    //init empty board with only covered cell sprites (mines will be generated after first click)
    for (let i = 0; i < rows_amt; i++) {
        for (let j = 0; j < cols_amt; j++) {
            let cell_sprite = createCellSprite(i, j, () => {
                //clear board and init
                om.clear('image');
                ms_game_init(i, j);
                speed_timer.start();
            });
            cell_sprite.cell = {};
        }
    }
}

window.ms_empty_init = ms_empty_init;

function ms_game_init(x, y) {
    //ms_mines_generate(x, y);
    uncovered_cells = 0;
    mines_locations = [];
    ms_mines_generate_poisson_disk_sampling(x, y);
    ms_cells_rows_generate();
    ms_cells_neighbors_calculate();
    ms_cells_generate(x, y);
}

//create image of single covered cell on top of board

//ms_game_init();
ms_empty_init();
// #endregion

// #region functions
function uncover_cell(cell_sprite) {
    if (cell_sprite.cell.uncovered || cell_sprite.cell.flagged) return;
    cell_sprite.cell.uncovered = true;
    if (cell_sprite.cell.neighbors > 0) {
        cell_sprite.asset = a_numbers[cell_sprite.cell.neighbors - 1];
    } else cell_sprite.asset = a_uncovered;
    uncovered_cells++;
    if (uncovered_cells == cols_amt * rows_amt - mines_amt) {
        gameWon();
    }
}

function flood_uncover(cell_sprite, i = 0) {
    if (cell_sprite.cell.uncovered || cell_sprite.cell.flagged) return;
    if (cell_sprite.cell.neighbors > 0) {
        uncover_cell(cell_sprite);
        return;
    } else {
        uncover_cell(cell_sprite);
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x == 0 && y == 0) continue;
                if (
                    cell_sprite.cell.x + x < 0 ||
                    cell_sprite.cell.x + x >= cols_amt ||
                    cell_sprite.cell.y + y < 0 ||
                    cell_sprite.cell.y + y >= rows_amt
                ) {
                    continue;
                }
                flood_uncover(
                    cells[cell_sprite.cell.x + x][cell_sprite.cell.y + y],
                    i + 1
                );
            }
        }
    }
}

var cell_on_click = (cell, cell_sprite, i, j, rightClick) => {
    if (rightClick) {
        if (cell.uncovered) return;
        cell.flagged = !cell.flagged;
        cell_sprite.asset = cell.flagged ? a_flag : a_covered;
        return;
    }
    if (cell.flagged) return;
    if (cell.mine) {
        cell_sprite.asset = a_bomb;
        gameOver();
        return;
    }
    if (cell.uncovered) {
        if (cell.neighbors > 0) {
            let flags = 0;
            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y++) {
                    if (x == 0 && y == 0) continue;
                    if (
                        cell.x + x < 0 ||
                        cell.x + x >= cols_amt ||
                        cell.y + y < 0 ||
                        cell.y + y >= rows_amt
                    ) {
                        continue;
                    }
                    if (cells[cell.x + x][cell.y + y].cell.flagged) {
                        flags++;
                    }
                }
            }
            //Check if there are as many flags as neighbors
            if (flags == cell.neighbors) {
                for (let x = -1; x <= 1; x++) {
                    for (let y = -1; y <= 1; y++) {
                        if (x == 0 && y == 0) continue;
                        if (
                            cell.x + x < 0 ||
                            cell.x + x >= cols_amt ||
                            cell.y + y < 0 ||
                            cell.y + y >= rows_amt
                        ) {
                            continue;
                        }
                        if (!cells[cell.x + x][cell.y + y].cell.flagged) {
                            if (
                                cells[cell.x + x][cell.y + y].cell.neighbors > 0
                            ) {
                                uncover_cell(cells[cell.x + x][cell.y + y]);
                            } else {
                                flood_uncover(cells[cell.x + x][cell.y + y]);
                            }
                        }
                    }
                }
            }
        }
        return;
    }
    flood_uncover(cell_sprite);

    uncover_cell(cell_sprite);
};

window.saveGameState = () => {
    const state = {
        config: {
            rows: rows_amt,
            cols: cols_amt,
            mines_min,
            mines_max,
            mines_amt,
            mines_distribution_factor,
            mines_safe_radius,
        },
        game: {
            mines_locations,
            uncovered_cells,
            cells: rows.map((row) =>
                row.map((cell) => ({
                    x: cell.x,
                    y: cell.y,
                    mine: cell.mine,
                    flagged: cell.flagged,
                    uncovered: cell.uncovered,
                    neighbors: cell.neighbors,
                }))
            ),
        },
    };
    return JSON.stringify(state);
};

window.loadGameState = (jsonState) => {
    try {
        const state = JSON.parse(jsonState);

        // Load configuration
        Object.assign(window, state.config);

        // Load game state
        mines_locations = state.game.mines_locations;
        uncovered_cells = state.game.uncovered_cells;

        // Recreate rows array with cell data
        rows = state.game.cells.map((row) =>
            row.map((cellData) => ({ ...cellData }))
        );

        // Clear and recreate visual board
        om.clear();
        board = om.create.rectangle(
            () => window.innerWidth / 2 - display_board_width / 2,
            () => window.innerHeight / 2 - display_board_height / 2,
            () => display_board_width,
            () => display_board_height,
            { fill: boardFill, border: { color: boardBorder } }
        );

        // Recreate cell sprites with correct states
        cells = [];
        rows.forEach((row, i) => {
            row.forEach((cell, j) => {
                let cell_sprite = createCellSprite(i, j, (rightClick) =>
                    cell_on_click(cell, cell_sprite, i, j, rightClick)
                );
                cell_sprite.cell = cell;
                cells[j]
                    ? (cells[j][i] = cell_sprite)
                    : (cells[j] = [cell_sprite]);

                // Set correct sprite based on cell state
                if (cell.uncovered) {
                    cell_sprite.asset =
                        cell.neighbors > 0
                            ? a_numbers[cell.neighbors - 1]
                            : a_uncovered;
                } else if (cell.flagged) {
                    cell_sprite.asset = a_flag;
                }
            });
        });

        return true;
    } catch (error) {
        console.error('Failed to load game state:', error);
        return false;
    }
};

// Example usage:
/*
// Save current game state
const savedState = saveGameState();
localStorage.setItem('minesweeper_save', savedState);

// Load saved game state
const loadedState = localStorage.getItem('minesweeper_save');
if (loadedState) {
    loadGameState(loadedState);
}
*/
// #endregion

// #region events
function gameOver() {
    speed_timer.stop();
    Swal.fire({
        title: 'Game Over!',
        text: 'You hit a mine!',
        icon: 'error',
        confirmButtonText: 'Try again',
    }).then(() => {
        om.clear();
        ms_empty_init();
    });
}

function gameWon() {
    speed_timer.stop();
    //ask for username (optional)
    Swal.fire({
        title: 'Congratulations!',
        text: 'You won!',
        icon: 'success',
        input: 'text',
        inputLabel: 'Enter your name (Optional)',
        inputPlaceholder: 'Anonymous',
        confirmButtonText: 'Submit',
        showLoaderOnConfirm: true,
        preConfirm: (username) => {
            return fetch('/highscore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    speed: speed_timer.clock,
                    columns: cols_amt,
                    rows: rows_amt,
                    mines: mines_amt,
                    username: username || 'Anonymous',
                }),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }
                    fetchHighscores();
                    return response.text();
                })
                .catch((error) => {
                    Swal.showValidationMessage(`Request failed: ${error}`);
                });
        },
        allowOutsideClick: () => !Swal.isLoading(),
    }).then(() => {
        om.clear();
        ms_empty_init();
    });
    /*Swal.fire({
        title: 'Congratulations!',
        text: 'You won!',
        icon: 'success',
        confirmButtonText: 'Play again',
    }).then(() => {
        om.clear();
        ms_empty_init();
    });*/
}

async function fetchHighscores() {
    try {
        const response = await fetch('/highscores');
        const highscores = await response.json();
        const highscoresTableBody = document.getElementById(
            'highscoresTableBody'
        );
        const highscoreTemplate =
            document.getElementById('highscoreTemplate').content;
        highscoresTableBody.innerHTML = '';
        console.log(highscores);
        highscores.forEach((score, index) => {
            const clone = document.importNode(highscoreTemplate, true);
            clone.querySelector('.rank').textContent = index + 1;
            clone.querySelector('.name').textContent = score.username;
            clone.querySelector('.score').textContent = score.score;
            highscoresTableBody.appendChild(clone);
        });
    } catch (error) {
        console.error('Failed to fetch highscores:', error);
    }
}

document.getElementById('backButtonGame').addEventListener('click', () => {
    //confirm if user wants to leave
    if (confirm('Are you sure you want to leave?')) {
        //reset game
        om.clear();
        ms_empty_init();
        uim.change_page(1);
        document.getElementById('highscoresWrapper').classList.add('hidden');
    }
});

document
    .getElementById('backButtonHighscores')
    .addEventListener('click', () => {
        uim.change_page(1);
    });

// Fetch and display highscores when the page loads
fetchHighscores();
// #endregion
