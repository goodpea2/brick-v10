
// sawmill.js
import { Brick } from './brick.js';

/**
 * Checks if there's any valid empty spot for any sawmill, or if any sawmill has internal capacity.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 * @returns {boolean} - True if at least one sawmill can produce, false otherwise.
 */
export function canSawmillProduce(homeBaseBricks, board) {
    const sawmills = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Sawmill') {
                    sawmills.push(brick);
                }
            }
        }
    }

    if (sawmills.length === 0) return false;
    
    // For any sawmill, check if it can produce
    for (const sawmill of sawmills) {
        // 1. Check for internal capacity space
        if (sawmill.internalResourcePool < sawmill.localResourceCapacity) {
            return true;
        }

        // 2. Check for external spawn spots if capacity full/near full (actually, standard check for output availability)
        const connectedNetwork = new Set();
        const queue = [sawmill];
        const visited = new Set([sawmill]);

        while (queue.length > 0) {
            const current = queue.shift();
            connectedNetwork.add(current);

            const currentC = current.c + 6;
            const currentR = current.r + 6;

            for (const dir of [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}]) {
                const nextC = currentC + dir.c;
                const nextR = currentR + dir.r;

                if (nextC >= 0 && nextC < board.cols && nextR >= 0 && nextR < board.rows) {
                    const neighbor = homeBaseBricks[nextC][nextR];
                    if (neighbor && neighbor.type === 'LogBrick' && !visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }

        for (const spawner of connectedNetwork) {
            const spawnerC = spawner.c + 6;
            const spawnerR = spawner.r + 6;
            for (const dir of [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}]) {
                const emptyC = spawnerC + dir.c;
                const emptyR = spawnerR + dir.r;
                if (emptyC >= 0 && emptyC < board.cols && emptyR >= 0 && emptyR < board.rows && !homeBaseBricks[emptyC][emptyR]) {
                    return true; // Found an empty spot
                }
            }
        }
    }

    return false; // No sawmill can produce
}


/**
 * Handles the logic for a single Sawmill brick growing a LogBrick (10 wood).
 * @param {p5} p - The p5 instance.
 * @param {Brick} sawmill - The specific Sawmill brick instance.
 * @param {object} board - The game board configuration.
 * @returns {boolean} - True if a LogBrick was successfully spawned, false otherwise.
 */
export function handleSawmillGeneration(p, sawmill, board) {
    // Note: The caller (sketch.js) handles resource deduction if this returns true.
    // We only need to check if we can place *one* LogBrick.

    const homeBaseBricks = p.getHomeBaseBricks(); // Access current state
    
    const connectedNetwork = new Set();
    const queue = [sawmill];
    const visited = new Set([sawmill]);

    while (queue.length > 0) {
        const current = queue.shift();
        connectedNetwork.add(current);

        const currentC = current.c + 6;
        const currentR = current.r + 6;

        [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}].forEach(dir => {
            const nextC = currentC + dir.c;
            const nextR = currentR + dir.r;

            if (nextC >= 0 && nextC < board.cols && nextR >= 0 && nextR < board.rows) {
                const neighbor = homeBaseBricks[nextC][nextR];
                if (neighbor && neighbor.type === 'LogBrick' && !visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        });
    }

    const validSpawnSpots = [];
    connectedNetwork.forEach(spawner => {
        const spawnerC = spawner.c + 6;
        const spawnerR = spawner.r + 6;
        [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}].forEach(dir => {
            const emptyC = spawnerC + dir.c;
            const emptyR = spawnerR + dir.r;
            if (emptyC >= 0 && emptyC < board.cols && emptyR >= 0 && emptyR < board.rows && !homeBaseBricks[emptyC][emptyR]) {
                validSpawnSpots.push({ c: emptyC, r: emptyR });
            }
        });
    });

    if (validSpawnSpots.length === 0) {
        return false; // Blocked
    }

    const spot = p.random(validSpawnSpots);
    const newBrick = new Brick(p, spot.c - 6, spot.r - 6, 'LogBrick', 10, board.gridUnitSize);
    homeBaseBricks[spot.c][spot.r] = newBrick;
    
    return true; // Success
}
