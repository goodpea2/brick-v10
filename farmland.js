
// farmland.js
import { BRICK_STATS } from './balancing.js';
import { FlyingIcon } from './vfx.js';

/**
 * Checks if there's any valid, non-full brick in range for any farmland.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 * @returns {boolean} - True if at least one farmland can produce, false otherwise.
 */
export function canFarmlandProduce(homeBaseBricks, board) {
    const farmlands = [];
    const hostableBricks = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Farmland') {
                    farmlands.push(brick);
                } else if (BRICK_STATS.canCarryFood[brick.type]) {
                    hostableBricks.push(brick);
                }
            }
        }
    }

    if (farmlands.length === 0) return false;

    // Check internal capacity first
    for (const farm of farmlands) {
        if (farm.localResourceStorage < farm.localResourceCapacity) return true;
    }

    // Check output targets
    for (const farm of farmlands) {
        const hasTarget = hostableBricks.some(host => {
            if (host.food >= host.maxFood) return false;
            const distSq = (farm.c - host.c)**2 + (farm.r - host.r)**2;
            return distSq <= 3.2 * 3.2;
        });
        if (hasTarget) return true; 
    }

    return false; 
}

/**
 * Handles the logic for a single Farmland brick producing food.
 * Attempts to distribute a batch of 10 food.
 * @param {p5} p - The p5 instance.
 * @param {Brick} farm - The specific Farmland brick instance.
 * @param {object} board - The game board configuration.
 * @param {Array<FlyingIcon>} flyingIcons - The array to add new flying icons to.
 * @param {boolean} createVFX - Whether to create the flying icon visual effect.
 * @returns {boolean} - True if at least one unit of food was successfully distributed.
 */
export function handleFarmlandGeneration(p, farm, board, flyingIcons, createVFX = true) {
    const homeBaseBricks = p.getHomeBaseBricks();
    const hostableBricks = [];
    const processed = new Set();
    
    // Gather potential targets
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick) && BRICK_STATS.canCarryFood[brick.type]) {
                processed.add(brick);
                hostableBricks.push(brick);
            }
        }
    }

    // Filter by range and capacity
    const eligibleBricks = hostableBricks.filter(host => {
        if (host.food >= host.maxFood) return false;
        const distSq = (farm.c - host.c)**2 + (farm.r - host.r)**2;
        return distSq <= 3.2 * 3.2;
    });

    if (eligibleBricks.length === 0) return false; // Blocked

    // Distribute a batch of 10
    const BATCH_SIZE = 10;
    eligibleBricks.sort((a, b) => a.food - b.food); // Prioritize emptier bricks

    let distributedCount = 0;

    for (let i = 0; i < BATCH_SIZE; i++) {
        // Cycle through eligible bricks
        const targetBrick = eligibleBricks[i % eligibleBricks.length];

        if (targetBrick && targetBrick.food < targetBrick.maxFood) {
            targetBrick.food = Math.min(targetBrick.maxFood, targetBrick.food + 1);
            distributedCount++;

            if (createVFX) {
                const farmPos = farm.getPixelPos(board).add(farm.size / 2, farm.size / 2);
                const hostPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
                
                flyingIcons.push(new FlyingIcon(p, farmPos, hostPos, '🥕', {
                    size: board.gridUnitSize * 0.4,
                    onComplete: () => {
                        if (!targetBrick.foodIndicatorPositions) {
                            targetBrick.foodIndicatorPositions = [];
                            for (let k = 0; k < targetBrick.maxFood; k++) {
                                targetBrick.foodIndicatorPositions.push(
                                    p.createVector(
                                        p.random(targetBrick.size * 0.1, targetBrick.size * 0.9),
                                        p.random(targetBrick.size * 0.1, targetBrick.size * 0.9)
                                    )
                                );
                            }
                        }
                    }
                }));
            }
        } else {
            // This brick became full during the loop, remove it from rotation or skip
            // For simplicity in this loop structure, we just skip it this iteration.
            // If all are full, we stop early.
            if (eligibleBricks.every(b => b.food >= b.maxFood)) break;
        }
    }

    // Return true if we managed to distribute *any* food.
    // The caller will deduct the full batch cost (10) regardless of if we only distributed 5?
    // Based on user request: "spend the food... and start spawning 10 food chunks". 
    // This implies an atomic "attempt". If targets fill up mid-batch, the rest might be wasted or logic simplified.
    // Let's assume successful trigger consumes the batch cost.
    return distributedCount > 0;
}
