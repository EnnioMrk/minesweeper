/*global cvh_game, cvh_object_manager, assetLoader, uih_manager*/
let uim;

(async () => {
    // #region config
    let rows_amt = 10;
    let cols_amt = 10;
    let mines_min = 10;
    let mines_max = 15;
    let mines_amt;

    let smallest_dim =
        window.innerWidth < window.innerHeight
            ? window.innerWidth
            : window.innerHeight;
    //in percentage to full
    let board_size = 50;
    let cell_magnify =
        (smallest_dim / 16 / rows_amt - 0.5) * (board_size / 100);
    let cell_size = 16;
    let cell_padding = 1;
    let board_width = cols_amt * (cell_size + cell_padding) * cell_magnify;
    // #endregion
    // #region setup
    const gameCanvas = document.getElementById('game');
    const gameWrapper = document.getElementById('gameWrapper');
    const mainWrapper = document.getElementById('mainWrapper');

    let game = new cvh_game(
        gameCanvas,
        [window.innerWidth, window.innerHeight],
        {
            backgroundColor: 'rgba(255, 255, 255, 0)',
        }
    );

    let om = new cvh_object_manager(game);

    uim = new uih_manager(game, mainWrapper);
    await uim.get_all_templates();
    const ui_config_file = await fetch('/assets/ui.json');
    const ui_config = await ui_config_file.json();
    uim.register_page(
        gameWrapper,
        'Game',
        () => {
            game.start();
        },
        () => {
            game.stop();
        }
    );
    uim.load_ui(ui_config);

    //game.start();

    om.createClickListener();

    let sprites_blob = await fetch('assets/sprites.png').then((response) =>
        response.blob()
    );
    let asset_loader = new assetLoader(sprites_blob, 16);
    await asset_loader.loadAll();

    let a_numbers = asset_loader.assets.slice(0, 8);
    let [a_uncovered, a_covered, a_bomb, a_flag] = asset_loader.assets.slice(
        8,
        12
    );

    let rows = new Array();
    let mines_locations = new Array();
    // #endregion
    // #region init
    function ms_mines_generate() {
        mines_amt =
            Math.floor(Math.random() * (mines_max - mines_min)) + mines_min;
        for (let i = 0; i < mines_amt; i++) {
            let x = Math.floor(Math.random() * cols_amt);
            let y = Math.floor(Math.random() * rows_amt);
            if (mines_locations.some((m) => m[0] == x && m[1] == y)) i--;
            else mines_locations.push([x, y]);
        }
    }

    function ms_cells_rows_generate() {
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

    let board = om.create.rectangle(
        window.innerWidth / 2 - board_width / 2,
        window.innerHeight / 2 - board_width / 2,
        board_width,
        board_width,
        { fill: '#bbb', border: { color: '#eee' } }
    );

    function ms_cells_generate() {
        rows.forEach((row, i) => {
            row.forEach((cell, j) => {
                let cell_sprite = om.create.image(
                    board.x +
                        j * (cell_size + cell_padding) * cell_magnify +
                        cell_padding,
                    board.y +
                        i * (cell_size + cell_padding) * cell_magnify +
                        cell_padding,
                    a_covered,
                    {
                        magnify: cell_magnify,
                        onClick: () =>
                            cell_on_click(cell, cell_sprite, i, j, false),
                        onRightClick: () =>
                            cell_on_click(cell, cell_sprite, i, j, true),
                    }
                );
                cell_sprite.cell = cell;
                cells[j]
                    ? (cells[j][i] = cell_sprite)
                    : (cells[j] = [cell_sprite]);
            });
        });
    }

    function ms_game_init() {
        ms_mines_generate();
        ms_cells_rows_generate();
        ms_cells_neighbors_calculate();
        ms_cells_generate();
    }

    ms_game_init();
    // #endregion

    // #region functions
    function uncover_cell(cell_sprite) {
        if (cell_sprite.cell.uncovered) return;
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
        if (cell_sprite.cell.uncovered) return;
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
        if (cell.uncovered) return;
        flood_uncover(cell_sprite);

        uncover_cell(cell_sprite);
    };

    // #endregion

    // #region events
    function gameOver() {
        alert('Game Over');
    }

    function gameWon() {
        alert('You won!');
    }
    // #endregion
})();
