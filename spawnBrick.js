// spawnBrick.js
import { BALL_STATS } from './balancing.js';
import { Brick } from './brick.js';
import { state } from './state.js';

export function handleBrickSpawnPowerup(effect, context) {
    const { p, board, bricks, processEvents, processBrokenBricks } = context;
    const { center, coinChance, bonusMines = 0 } = effect;
    const tiles = BALL_STATS.types.brick.spawnRadiusTiles;
    const radius = tiles * board.gridUnitSize;
    const gridPositions = new Set();
    for (let i = 0; i < 72; i++) {
        const angle = p.TWO_PI / 72 * i;
        const x = center.x + radius * p.cos(angle), y = center.y + radius * p.sin(angle);
        const gridC = Math.round((x - board.genX) / board.gridUnitSize), gridR = Math.round((y - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) gridPositions.add(`${gridC},${gridR}`);
    }
    spawnBricksAtPositions(gridPositions, context, coinChance, bonusMines);
}

export function handleCrossBrickSpawnPowerup(effect, context) {
    const { p, board } = context;
    const { center, coinChance, bonusMines = 0 } = effect;
    const gridC = Math.round((center.x - board.genX) / board.gridUnitSize);
    const gridR = Math.round((center.y - board.genY) / board.gridUnitSize);
    
    const gridPositions = new Set();
    
    // Horizontal Line
    for (let c = 0; c < board.cols; c++) {
        gridPositions.add(`${c},${gridR}`);
    }
    // Vertical Line
    for (let r = 0; r < board.rows; r++) {
        gridPositions.add(`${gridC},${r}`);
    }
    
    const finalCoinChance = state.upgradeableStats.crossCoinChance || coinChance;
    spawnBricksAtPositions(gridPositions, context, finalCoinChance, bonusMines);
}

export function handleHollowBrickPowerup(effect, context) {
    const { p, board, bricks } = context;
    const { center, radiusTiles, coinChance, bonusMines = 0 } = effect;
    const radiusSq = (radiusTiles * board.gridUnitSize) ** 2;

    // 1. Identify bricks to push
    const bricksToPush = [];
    const occupied = new Set();
    
    for(let c=0; c<board.cols; c++) {
        for(let r=0; r<board.rows; r++) {
            const brick = bricks[c][r];
            if (brick) {
                occupied.add(`${c},${r}`);
                const bPos = brick.getPixelPos(board).add(brick.size/2, brick.size/2);
                if (p.constructor.Vector.sub(bPos, center).magSq() <= radiusSq && brick.type === 'normal') {
                    bricksToPush.push(brick);
                }
            }
        }
    }
    
    // 2. Push bricks away
    bricksToPush.forEach(brick => {
        let bestSpot = null;
        let minDist = Infinity;
        
        for(let r=1; r<board.cols; r++) {
             if (bestSpot) break;
             for (let i = 0; i < 16; i++) {
                 const angle = (p.TWO_PI / 16) * i;
                 const vectorFromCenter = p.createVector(brick.c - (center.x-board.genX)/board.gridUnitSize, brick.r - (center.y-board.genY)/board.gridUnitSize);
                 const targetDist = Math.ceil(radiusTiles) + r;
                 const checkC = Math.round((center.x - board.genX)/board.gridUnitSize + Math.cos(vectorFromCenter.heading()) * targetDist);
                 const checkR = Math.round((center.y - board.genY)/board.gridUnitSize + Math.sin(vectorFromCenter.heading()) * targetDist);
                 
                 if (checkC >= 0 && checkC < board.cols && checkR >= 0 && checkR < board.rows) {
                     if (!occupied.has(`${checkC},${checkR}`)) {
                         bestSpot = { c: checkC, r: checkR };
                         break;
                     }
                 }
             }
        }
        
        if (bestSpot) {
            const oldC = brick.c + 6;
            const oldR = brick.r + 6;
            bricks[oldC][oldR] = null;
            
            brick.c = bestSpot.c - 6;
            brick.r = bestSpot.r - 6;
            bricks[bestSpot.c][bestSpot.r] = brick;
            occupied.add(`${bestSpot.c},${bestSpot.r}`);
            occupied.delete(`${oldC},${oldR}`);
        } else {
             brick.hit(10000, 'hollow_crush', board);
        }
    });
    
    // 3. Spawn ring bricks
    const ringPositions = new Set();
    for (let i = 0; i < 72; i++) {
        const angle = p.TWO_PI / 72 * i;
        const x = center.x + (radiusTiles * board.gridUnitSize) * p.cos(angle);
        const y = center.y + (radiusTiles * board.gridUnitSize) * p.sin(angle);
        const gridC = Math.round((x - board.genX) / board.gridUnitSize);
        const gridR = Math.round((y - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) ringPositions.add(`${gridC},${gridR}`);
    }
    
    const finalCoinChance = state.upgradeableStats.hollowCoinChance || coinChance;
    spawnBricksAtPositions(ringPositions, context, finalCoinChance, bonusMines);
}

function spawnBricksAtPositions(gridPositions, context, coinChance, bonusMines) {
    const { p, board, bricks, processEvents, processBrokenBricks } = context;
    const bricksToKillAndReplace = [], emptySpotsToFill = [];
    
    gridPositions.forEach(posStr => {
        const [gridC, gridR] = posStr.split(',').map(Number);
        let existingBrick = bricks[gridC][gridR];
        if (existingBrick) {
            if (existingBrick.type === 'normal') bricksToKillAndReplace.push({ brick: existingBrick, pos: { c: gridC, r: gridR } });
        } else {
            emptySpotsToFill.push({ c: gridC, r: gridR });
        }
    });
    
    bricksToKillAndReplace.forEach(item => {
        const hitResult = item.brick.hit(10000, 'replaced', board);
        if (hitResult) processEvents([{ type: 'brick_hit', ...hitResult }]);
    });
    processBrokenBricks(null, context);
    
    const spotsForNewBricks = emptySpotsToFill.concat(bricksToKillAndReplace.map(item => item.pos));
    const newBricks = [];
    spotsForNewBricks.forEach(pos => {
        if (!bricks[pos.c][pos.r]) { 
            const newBrick = new Brick(p, pos.c - 6, pos.r - 6, 'normal', 10, board.gridUnitSize);
            if (p.random() < coinChance) {
                const coinsToAdd = p.floor(p.random(5, 15));
                newBrick.coins = coinsToAdd;
                newBrick.maxCoins = coinsToAdd;
            }
            bricks[pos.c][pos.r] = newBrick;
            newBricks.push(newBrick);
        }
    });

    if (bonusMines > 0 && newBricks.length > 0) {
        p.shuffle(newBricks, true);
        for (let i = 0; i < Math.min(bonusMines, newBricks.length); i++) {
            newBricks[i].overlay = 'mine';
        }
    }
}