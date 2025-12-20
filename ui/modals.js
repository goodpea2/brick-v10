
// ui/modals.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_DESCRIPTIONS } from '../text.js';
import { sounds } from '../sfx.js';
import { MILESTONE_LEVELS } from '../firstTimeLevels.js';
import { UNLOCK_LEVELS, DEFAULT_LEVEL_SETTINGS } from '../balancing.js';

function closeModalWithAnimation(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('closing');
    setTimeout(() => {
        modalElement.classList.add('hidden');
        modalElement.classList.remove('closing');
    }, 200); // Matches CSS transition duration
}

export function showLevelUpModal(level) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }

    let unlockText = UNLOCK_DESCRIPTIONS[level];
    
    if (!unlockText) {
        const allUnlockLevels = Object.values(UNLOCK_LEVELS).sort((a, b) => a - b);
        const nextUnlockLevel = allUnlockLevels.find(l => l > level);
        
        if (nextUnlockLevel) {
            unlockText = `New feature unlocks at Level ${nextUnlockLevel}!`;
        } else {
            unlockText = "You've reached max level for now. More content coming later!";
        }
    }

    dom.levelUpLevelEl.textContent = level;
    dom.levelUpUnlockTextEl.textContent = unlockText;
    dom.levelUpModal.classList.remove('hidden');
}

function getWeightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
        if (random < item.weight) {
            return item.value;
        }
        random -= item.weight;
    }
    return items[items.length - 1].value;
}


export function showLevelCompleteModal(stats, gameController, level) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }

    dom.statLC_BallsUsed.textContent = stats.ballsUsed;
    dom.statLC_DamageDealt.textContent = Math.floor(stats.totalDamage);
    dom.statLC_BestTurnDamage.textContent = Math.floor(stats.maxDamageInTurn);
    dom.statLC_CoinsCollected.textContent = Math.floor(stats.coinsCollected);
    dom.statLC_XpCollected.textContent = Math.floor(stats.xpCollected);

    dom.levelCompleteChoices.innerHTML = '';
    
    const nextLevel = level + 1;
    const isNextLevelMilestone = !!MILESTONE_LEVELS[nextLevel] && !state.milestonesCompleted[nextLevel];

    if (state.gameMode !== 'adventureRun' || isNextLevelMilestone) {
        const button = document.createElement('button');
        button.className = 'modal-action-button';
        button.textContent = 'Continue';
        if (isNextLevelMilestone) {
            button.title = 'The next level is a special milestone!';
        }
        button.onclick = async () => {
             sounds.buttonClick();
            closeModalWithAnimation(dom.levelCompleteModal);
            await gameController.nextLevel();
        
            if (state.p5Instance) {
                state.p5Instance.isModalOpen = false;
                if (!state.isRunning) {
                    state.p5Instance.loop();
                    state.isRunning = true;
                    dom.pauseResumeBtn.textContent = 'Resume';
                }
            }
        };
        dom.levelCompleteChoices.appendChild(button);
        dom.levelCompleteModal.classList.remove('hidden');
        return;
    }

    let specialRoomChoices = [
        { value: { type: 'gem', text: 'Continue 💎', description: 'Next level has guaranteed Gems, but no +1 Ball bricks.' }, weight: 1 },
        { value: { type: 'food', text: 'Continue 🥕', description: 'Coins in the next level are replaced with Food.' }, weight: 3 },
        { value: { type: 'wood', text: 'Continue 🪵', description: 'Coins in the next level are replaced with Log Bricks.' }, weight: 3 },
        { value: { type: 'lucky', text: 'Continue 🍀', description: 'Random positive event will occur in the next level.' }, weight: 2 },
        { value: { type: 'danger', text: 'Continue ⚠️', description: 'The next level will be much harder, but with bonus Gem rewards.' }, weight: 2 },
    ];
    
    // Gating room choices based on main level
    if (state.mainLevel < UNLOCK_LEVELS.GEM_ROOM) {
        specialRoomChoices = specialRoomChoices.filter(choice => choice.value.type !== 'gem');
    }
    if (state.mainLevel < UNLOCK_LEVELS.DANGER_LUCKY_ROOMS) {
        specialRoomChoices = specialRoomChoices.filter(choice => 
            choice.value.type !== 'lucky' && choice.value.type !== 'danger'
        );
    }
    if (state.mainLevel < UNLOCK_LEVELS.HOME_BASE) {
        specialRoomChoices = specialRoomChoices.filter(choice => 
            choice.value.type !== 'food' && choice.value.type !== 'wood'
        );
    }
    
    const numOptionsChoices = [
        { value: 'normal_only', weight: 5 },
        { value: 'one_special', weight: 3 },
        { value: 'two_special', weight: 5 },
        { value: 'three_special', weight: 3 },
    ];
    const outcome = getWeightedRandom(numOptionsChoices);

    const finalChoices = new Set();
    
    if (outcome === 'normal_only' || specialRoomChoices.length === 0) {
        finalChoices.add({ type: 'normal', text: 'Continue', description: 'Proceed to the next standard level.' });
    } else {
        let numSpecialOptions = 0;
        if (outcome === 'one_special') numSpecialOptions = 1;
        else if (outcome === 'two_special') numSpecialOptions = 2;
        else if (outcome === 'three_special') numSpecialOptions = 3;

        let availableSpecialRooms = [...specialRoomChoices];
        for (let i = 0; i < numSpecialOptions; i++) {
            if (availableSpecialRooms.length === 0) break;
            const choice = getWeightedRandom(availableSpecialRooms);
            finalChoices.add(choice);
            availableSpecialRooms = availableSpecialRooms.filter(c => c.value.type !== choice.type);
        }
    }
    
    if (finalChoices.size === 0) {
        finalChoices.add({ type: 'normal', text: 'Continue', description: 'Proceed to the next standard level.' });
    }

    const currentFinalChoices = Array.from(finalChoices);

    if (state.skillTreeState['paid_resource_rooms']) {
        const nextLevelNum = level + 1;
        const s = DEFAULT_LEVEL_SETTINGS;
        const nextCoinPool = Math.min(s.maxCoin, s.startingCoin + (nextLevelNum - 1) * s.coinIncrement);
        
        const alreadyHasFood = currentFinalChoices.some(c => c.type === 'food');
        const alreadyHasWood = currentFinalChoices.some(c => c.type === 'wood');

        if (!alreadyHasFood) {
            const costFood = Math.max(5, Math.floor(nextCoinPool * 0.25 * (1 + Math.random() * 2)));
            currentFinalChoices.push({ 
                type: 'food', 
                text: `Continue 🥕 for ${costFood}🪙`, 
                description: `Spend ${costFood} coins to force a Food Room.`, 
                cost: costFood 
            });
        }
        if (!alreadyHasWood) {
            const costWood = Math.max(5, Math.floor(nextCoinPool * 0.25 * (1 + Math.random() * 2)));
            currentFinalChoices.push({ 
                type: 'wood', 
                text: `Continue 🪵 for ${costWood}🪙`, 
                description: `Spend ${costWood} coins to force a Wood Room.`, 
                cost: costWood 
            });
        }
    }

    currentFinalChoices.sort((a,b) => a.type === 'normal' ? -1 : 1).forEach(choice => {
        const button = document.createElement('button');
        button.className = 'modal-action-button';
        button.textContent = choice.text;
        button.title = choice.description;
        
        const playerCoins = gameController.getCoins();
        if (choice.cost && playerCoins < choice.cost) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.title += ` (Not enough coins: ${Math.floor(playerCoins)}/${choice.cost})`;
        }

        button.onclick = async () => {
            sounds.buttonClick();
            
            if (choice.cost) {
                gameController.setCoins(playerCoins - choice.cost);
            }

            state.nextRoomType = choice.type;
            closeModalWithAnimation(dom.levelCompleteModal);
    
            const levelStats = gameController.getLevelStats();
            const runStats = gameController.getRunStats();
    
            runStats.totalBallsUsed += levelStats.ballsUsed;
            runStats.totalDamageDealt += levelStats.totalDamage;
            runStats.totalEquipmentsCollected += levelStats.equipmentsCollected;
            runStats.totalCoinsCollected += levelStats.coinsCollected;
            runStats.totalXpCollected += levelStats.xpCollected;
            runStats.totalGemsCollected += levelStats.gemsCollected;
            
            gameController.setRunStats(runStats);
    
            await gameController.nextLevel();
        
            if (state.p5Instance) {
                state.p5Instance.isModalOpen = false;
                if (!state.isRunning) {
                    state.p5Instance.loop();
                    state.isRunning = true;
                    dom.pauseResumeBtn.textContent = 'Resume';
                }
            }
        };
        dom.levelCompleteChoices.appendChild(button);
    });

    dom.levelCompleteModal.classList.remove('hidden');
}

export function showGameOverModal(title, isGameOver = false, stats, levelReached, gameMode) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }
    
    const allStatBoxes = dom.gameOverModal.querySelectorAll('.stat-box');
    allStatBoxes.forEach(box => box.style.display = 'block');
    dom.gameOverModal.querySelector('hr').style.display = 'block';
    dom.gameOverModal.querySelector('h4').style.display = 'block';

    dom.statGO_GemsCollected.parentElement.querySelector('.stat-label').textContent = 'Gems 💎';
    dom.statGO_FoodCollected.parentElement.querySelector('.stat-label').textContent = 'Food 🥕';
    dom.statGO_WoodCollected.parentElement.querySelector('.stat-label').textContent = 'Wood 🪵';

    if (gameMode === 'invasionDefend') {
        dom.gameOverTitle.textContent = 'Base Overrun!';
        dom.gameOverTitle.classList.add('game-over');

        allStatBoxes.forEach(box => box.style.display = 'none');
        dom.gameOverModal.querySelector('hr').style.display = 'none';
        dom.gameOverModal.querySelector('h4').style.display = 'none';

        dom.statGO_LevelReached.parentElement.style.display = 'block';
        dom.statGO_LevelReached.parentElement.querySelector('.stat-label').textContent = 'Wave Reached';
        dom.statGO_LevelReached.textContent = state.invasionWave;

        dom.statGO_XpCollected.parentElement.style.display = 'block';
        if (stats) dom.statGO_XpCollected.textContent = Math.floor(stats.totalXpCollected);

    } else {
        dom.gameOverTitle.textContent = title;
        dom.gameOverTitle.classList.toggle('game-over', isGameOver);

        dom.statGO_LevelReached.parentElement.querySelector('.stat-label').textContent = 'Level Reached';

        if (gameMode === 'trialRun') {
            state.trialRunHighestLevelReached = Math.max(state.trialRunHighestLevelReached, levelReached);
            dom.statGO_GemsCollected.parentElement.querySelector('.stat-label').textContent = 'Metal 🪨';
            dom.statGO_FoodCollected.parentElement.querySelector('.stat-label').textContent = 'Wire 🪢';
            dom.statGO_WoodCollected.parentElement.querySelector('.stat-label').textContent = 'Fuel 🧊';
            dom.statGO_XpCollected.parentElement.style.display = 'none';
        } else if (gameMode === 'adventureRun') {
            state.highestLevelReached = Math.max(state.highestLevelReached, levelReached);
            state.previousRunLevel = levelReached;
            dom.statGO_XpCollected.parentElement.style.display = 'block';
            
            // Gating Food and Wood sections in Adventure Run Game Over
            if (state.mainLevel < UNLOCK_LEVELS.HOME_BASE) {
                dom.statGO_FoodCollected.parentElement.style.display = 'none';
                dom.statGO_WoodCollected.parentElement.style.display = 'none';
            }
        }

        if (stats) {
            dom.statGO_LevelReached.textContent = levelReached;
            dom.statGO_TotalBallsUsed.textContent = stats.totalBallsUsed;
            dom.statGO_TotalDamageDealt.textContent = Math.floor(stats.totalDamageDealt);
            dom.statGO_BestCombo.textContent = stats.bestCombo;
            dom.statGO_TotalEquipCollected.textContent = stats.totalEquipmentsCollected;
            dom.statGO_TotalCoinsCollected.textContent = Math.floor(stats.totalCoinsCollected);
            dom.statGO_XpCollected.textContent = Math.floor(stats.totalXpCollected);

            if (gameMode === 'trialRun') {
                dom.statGO_GemsCollected.textContent = Math.floor(stats.totalMetalCollected || 0);
                dom.statGO_FoodCollected.textContent = Math.floor(stats.totalWireCollected || 0);
                dom.statGO_WoodCollected.textContent = Math.floor(stats.totalFuelCollected || 0);
            } else {
                dom.statGO_GemsCollected.textContent = Math.floor(stats.totalGemsCollected);
                dom.statGO_FoodCollected.textContent = Math.floor(stats.totalFoodCollected);
                dom.statGO_WoodCollected.textContent = Math.floor(stats.totalWoodCollected);
            }
        }
    }


    dom.gameOverModal.classList.remove('hidden');
}
