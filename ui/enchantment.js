
// ui/enchantment.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { ENCHANTER_STATS, ENCHANTMENT_REQUIREMENTS, ENCHANTMENT_OUTCOMES, BALL_STATS, HOME_BASE_PRODUCTION } from '../balancing.js';
import { sounds } from '../sfx.js';
import { calculateProductionCost } from './ballRoster.js';
import * as event from '../eventManager.js';

let ballVisuals = {};
let gameController = null;
let selectedInstanceId = null;
let ingredientSlots = [null, null, null];
let enchantmentResult = null; // { success: bool, outcome: object|null, detailText: string }
let isEnchanting = false;

export const BALL_ENCHANTMENT_DISPLAY_CONFIG = {
    classic: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Chain Damage', getCurrent: (base, ench) => ench.bonusChainDamage || 0, getIncrease: () => 2, format: v => v }
    ],
    strong: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Chain Damage', getCurrent: (base, ench) => ench.bonusChainDamage || 0, getIncrease: () => 2, format: v => v }
    ],
    lightning: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Chain Damage', getCurrent: (base, ench) => (base.innateChainDamage || 0) + (ench.bonusChainDamage || 0), getIncrease: () => 2, format: v => v }
    ],
    explosive: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Explosion Radius', getCurrent: (base, ench) => (base.radiusTiles || 0) + (ench.bonusPowerUpValue || 0), getIncrease: () => 0.2, format: v => v.toFixed(1) }
    ],
    draining: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Explosion Radius', getCurrent: (base, ench) => (base.radiusTiles || 0) + (ench.bonusPowerUpValue || 0), getIncrease: () => 0.2, format: v => v.toFixed(1) }
    ],
    spray: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Explosion Radius', getCurrent: (base, ench) => (base.radiusTiles || 0) + (ench.bonusPowerUpValue || 0), getIncrease: () => 0.2, format: v => v.toFixed(1) }
    ],
    piercing: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Shield Duration', getCurrent: (base, ench) => ench.bonusEnergyShieldDuration || 0, getIncrease: () => 0.7, format: v => `${v.toFixed(1)}s` }
    ],
    phaser: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Shield Duration', getCurrent: (base, ench) => ench.bonusEnergyShieldDuration || 0, getIncrease: () => 0.7, format: v => `${v.toFixed(1)}s` }
    ],
    grow: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Shield Duration', getCurrent: (base, ench) => ench.bonusEnergyShieldDuration || 0, getIncrease: () => 0.7, format: v => `${v.toFixed(1)}s` }
    ],
    split: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Main Ball Armor', getCurrent: (base, ench) => ench.bonusMainBallArmor || 0, getIncrease: () => 1, format: v => v }
    ],
    cluster: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Main Ball Armor', getCurrent: (base, ench) => ench.bonusMainBallArmor || 0, getIncrease: () => 1, format: v => v }
    ],
    cell: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Main Ball Armor', getCurrent: (base, ench) => ench.bonusMainBallArmor || 0, getIncrease: () => 1, format: v => v }
    ],
    brick: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Mines Spawned', getCurrent: (base, ench) => ench.bonusPowerUpMineCount || 0, getIncrease: () => 1, format: v => v }
    ],
    cross: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Mines Spawned', getCurrent: (base, ench) => ench.bonusPowerUpMineCount || 0, getIncrease: () => 1, format: v => v }
    ],
    hollow: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Mines Spawned', getCurrent: (base, ench) => ench.bonusPowerUpMineCount || 0, getIncrease: () => 1, format: v => v }
    ],
    bullet: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Extra Bullets', getCurrent: (base, ench) => ench.bonusLastPowerUpBulletCount || 0, getIncrease: () => 4, format: v => v }
    ],
    octo: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Extra Bullets', getCurrent: (base, ench) => ench.bonusLastPowerUpBulletCount || 0, getIncrease: () => 4, format: v => v }
    ],
    gatling: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Extra Bullets', getCurrent: (base, ench) => ench.bonusLastPowerUpBulletCount || 0, getIncrease: () => 4, format: v => v }
    ],
    homing: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Homing Dmg', getCurrent: (base, ench) => (base.damage || 0) + (ench.bonusHomingExplosionDamage || 0), getIncrease: () => 10, format: v => v }
    ],
    seeker: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Homing Dmg', getCurrent: (base, ench) => (base.damage || 0) + (ench.bonusHomingExplosionDamage || 0), getIncrease: () => 10, format: v => v }
    ],
    chase: [
        { key: 'A', name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { key: 'B', name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.26, format: v => v.toFixed(1) },
        { key: 'C', name: 'Homing Dmg', getCurrent: (base, ench) => (base.damage || 0) + (ench.bonusHomingExplosionDamage || 0), getIncrease: () => 10, format: v => v }
    ],
};


export function initialize(controller, visuals) {
    gameController = controller;
    ballVisuals = visuals;

    dom.enchantmentModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.enchantmentModal.classList.add('hidden');
    });
}

// Exported function to open modal from Roster
export function openEnchantmentModal(ballInstanceId = null) {
    sounds.popupOpen();
    if (state.p5Instance) state.p5Instance.isModalOpen = true;
    
    enchantmentResult = null;
    ingredientSlots = [null, null, null];
    
    // Find the ball instance in inventory
    const instance = state.ballInventory.find(b => b.instanceId === ballInstanceId);
    
    if (instance) {
        selectedInstanceId = ballInstanceId;
        renderEnchantmentUI();
        dom.enchantmentModal.classList.remove('hidden');
    } else {
        console.error("Ball instance not found for enchantment:", ballInstanceId);
    }
}

function handleEnchant() {
    if (isEnchanting) return;
    isEnchanting = true;
    
    const controlsContainer = document.querySelector('.enchant-controls');
    if (controlsContainer) controlsContainer.classList.add('charging');
    
    sounds.enchantCharge(); // Start charging sound

    // Wait for animation (1.5s)
    setTimeout(() => {
        isEnchanting = false;
        if (controlsContainer) controlsContainer.classList.remove('charging');
        executeEnchantLogic();
    }, 1500);
}

// Helper to simulate stats object from an instance
function getStatsFromInstance(ballInstance) {
    const stats = { 
        level: ballInstance.level,
        hpMultiplier: 1.0, damageMultiplier: 1.0, bonusChainDamage: 0, 
        bonusPowerUpValue: 0, bonusEnergyShieldDuration: 0, bonusMainBallArmor: 0,
        bonusPowerUpMineCount: 0, bonusLastPowerUpBulletCount: 0, bonusHomingExplosionDamage: 0,
        productionCostMultiplier: 1.0 
    };
    
    if (ballInstance.outcomes) {
        ballInstance.outcomes.forEach(key => {
            const outcomeDef = ENCHANTMENT_OUTCOMES[ballInstance.type][key];
            if (outcomeDef) outcomeDef.apply(stats);
        });
    }
    return stats;
}

function executeEnchantLogic() {
    const ballInstance = state.ballInventory.find(b => b.instanceId === selectedInstanceId);
    if (!ballInstance) return;

    const currentLevel = ballInstance.level;
    if (currentLevel >= ENCHANTMENT_REQUIREMENTS.length) return;

    const requiredEP = ENCHANTMENT_REQUIREMENTS[currentLevel];
    const totalEP = ingredientSlots.reduce((sum, itemId) => {
        return sum + (itemId ? ENCHANTER_STATS[itemId].ep : 0);
    }, 0);

    const successRate = Math.min(100, (totalEP / requiredEP) * 100);
    const isSuccess = Math.random() < successRate / 100;

    if (isSuccess) {
        // 1. Calculate values BEFORE upgrade for diff
        const baseStats = BALL_STATS.types[ballInstance.type];
        const statsBefore = getStatsFromInstance(ballInstance);
        const config = BALL_ENCHANTMENT_DISPLAY_CONFIG[ballInstance.type];

        ballInstance.level++;
        
        // 2. Add random cost multiplier (0.0 to 1.0)
        const costMultiplier = Math.random();
        if (!ballInstance.costMultipliers) ballInstance.costMultipliers = [];
        ballInstance.costMultipliers.push(costMultiplier);

        const outcomes = Object.keys(ENCHANTMENT_OUTCOMES[ballInstance.type]);
        const randomOutcomeKey = outcomes[Math.floor(Math.random() * outcomes.length)];
        const outcome = ENCHANTMENT_OUTCOMES[ballInstance.type][randomOutcomeKey];
        
        ballInstance.outcomes.push(randomOutcomeKey);

        // 3. Calculate values AFTER upgrade
        const statsAfter = getStatsFromInstance(ballInstance);
        
        // 4. Determine display string
        let detailText = "Upgraded!";
        const statConf = config.find(c => c.key === randomOutcomeKey);
        
        if (statConf) {
            const valBefore = statConf.getCurrent(baseStats, statsBefore);
            const valAfter = statConf.getCurrent(baseStats, statsAfter);
            const diff = valAfter - valBefore;
            // Format +X.X or +X
            const diffFormatted = Number.isInteger(diff) ? diff : diff.toFixed(1);
            detailText = `${statConf.name} +${diffFormatted}`;
        }

        enchantmentResult = { success: true, outcome: outcome, detailText: detailText };
        sounds.enchantSuccess();
        
        // Dispatch event for other UIs (like Ball Roster)
        event.dispatch('BallUpgraded', { ballInstance });
    } else {
        enchantmentResult = { success: false, outcome: null, detailText: '' };
        sounds.enchantFail(); 
    }
    
    // Consume ingredients regardless of outcome
    ingredientSlots.forEach(itemId => {
        if (itemId) {
            state.playerEnchanters[itemId]--;
        }
    });

    ingredientSlots = [null, null, null];
    renderEnchantmentUI();
}

export function renderEnchantmentUI() {
    const ballListContainer = dom.enchantmentModal.querySelector('.enchant-ball-list');
    const mainPanel = dom.enchantmentModal.querySelector('.enchant-main-panel');
    
    // We don't use the sidebar ball list anymore in this new design, hiding or clearing it
    if (ballListContainer) {
        ballListContainer.style.display = 'none';
        dom.enchantmentModal.querySelector('.enchant-ui').style.justifyContent = 'center';
    }
    
    mainPanel.innerHTML = '';

    const ballInstance = state.ballInventory.find(b => b.instanceId === selectedInstanceId);
    if (!ballInstance) return;

    const currentLevel = ballInstance.level;
    const maxLevel = ENCHANTMENT_REQUIREMENTS.length;
    const ballType = ballInstance.type;

    // --- VISUALIZATION ROW (Current -> Next) ---
    const rowContainer = document.createElement('div');
    rowContainer.className = 'enchant-transformation-row';

    // Current Ball Card
    const createPreviewCard = (level, isTarget) => {
        const card = document.createElement('div');
        card.className = `enchant-ball-preview ${isTarget ? 'target' : ''}`;
        
        const visual = document.createElement('div');
        visual.className = 'ball-visual';
        if (ballVisuals[ballType]) visual.style.backgroundImage = `url(${ballVisuals[ballType]})`;
        
        const levelBadge = document.createElement('div');
        levelBadge.className = 'ball-level';
        levelBadge.textContent = `Lv.${level}`;
        
        card.appendChild(visual);
        card.appendChild(levelBadge);
        return card;
    };

    rowContainer.appendChild(createPreviewCard(currentLevel, false));
    
    const arrow = document.createElement('div');
    arrow.className = 'enchant-arrow';
    arrow.textContent = '→';
    rowContainer.appendChild(arrow);
    
    rowContainer.appendChild(createPreviewCard(currentLevel + 1, true));
    
    mainPanel.appendChild(rowContainer);

    // --- STATS DISPLAY ---
    const baseStats = BALL_STATS.types[ballType];
    const displayConfig = BALL_ENCHANTMENT_DISPLAY_CONFIG[ballType];
    const currentEnchData = getStatsFromInstance(ballInstance);
    
    // Calculate diamond counts
    const outcomeCounts = ballInstance.outcomes.reduce((acc, k) => { acc[k] = (acc[k]||0)+1; return acc; }, {});

    let statsListHTML = '';
    if (displayConfig) {
        displayConfig.forEach(statConf => {
            const currentValue = statConf.getCurrent(baseStats, currentEnchData);
            const increaseValue = statConf.getIncrease(currentValue);
            const diamonds = '♦'.repeat(outcomeCounts[statConf.key] || 0);
            
            // Format increase part: " +17 ? "
            const increasePart = currentLevel < maxLevel 
                ? `<span style="color:#98FB98;">+${statConf.format(increaseValue)} ?</span>` 
                : '';
                
            statsListHTML += `
                <li>
                    <span>${statConf.name}:</span>
                    <span>${statConf.format(currentValue)}</span>
                    <span class="stat-diamonds">${diamonds} <span class="diamond-filled"> </span></span>
                    ${increasePart}
                </li>
            `;
        });
    }

    // Cost prediction section
    const currentCost = calculateProductionCost(ballInstance);
    // Formula for next level logic: Current * (1 + (0.15 + (0.0 to 1.0)*0.15))
    // Min increase: 15%, Max increase: 30%
    const minNextCost = Math.round(currentCost * 1.15);
    const maxNextCost = Math.round(currentCost * 1.30);
    const minIncrease = minNextCost - currentCost;
    const maxIncrease = maxNextCost - currentCost;
    
    const costIncreaseRange = `${minIncrease}-${maxIncrease}`;

    const statsHTML = `
        <h3>Successful enchant randomly upgrades</h3>
        <ul>
            ${statsListHTML}
        </ul>
        <div class="enchant-production-cost">
            <span>Production Cost:</span>
            <span>🥕 ${currentCost}</span>
            <span>+${costIncreaseRange}</span>
        </div>
    `;

    const statsContainer = document.createElement('div');
    statsContainer.className = 'enchant-stats-display';
    statsContainer.innerHTML = statsHTML;
    mainPanel.appendChild(statsContainer);

    // --- INGREDIENTS & CONTROLS ---
    if (currentLevel < maxLevel) {
        const requiredEP = ENCHANTMENT_REQUIREMENTS[currentLevel];
        const totalEP = ingredientSlots.reduce((sum, itemId) => sum + (itemId ? ENCHANTER_STATS[itemId].ep : 0), 0);
        const successRate = Math.min(100, (totalEP / requiredEP) * 100);

        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'enchant-ingredient-slots';
        ingredientSlots.forEach((itemId, index) => {
            const slot = document.createElement('div');
            slot.className = 'enchant-slot';
            if (itemId) {
                slot.innerHTML = ENCHANTER_STATS[itemId].icon;
            }
            slot.onclick = () => {
                if (isEnchanting) return;
                if (itemId) {
                    ingredientSlots[index] = null;
                    renderEnchantmentUI();
                }
            };
            slotsContainer.appendChild(slot);
        });
        mainPanel.appendChild(slotsContainer);

        const inventoryContainer = document.createElement('div');
        inventoryContainer.className = 'enchant-inventory';
        Object.keys(ENCHANTER_STATS).forEach(itemId => {
            const itemData = ENCHANTER_STATS[itemId];
            const count = state.playerEnchanters[itemId] - ingredientSlots.filter(i => i === itemId).length;
            if (count > 0) {
                const card = document.createElement('div');
                card.className = 'enchant-item-card';
                card.innerHTML = `${itemData.icon}<span class="item-count">${count}</span>`;
                card.title = `${itemData.name} (${itemData.ep} EP)`;
                card.onclick = () => {
                    if (isEnchanting) return;
                    const emptySlotIndex = ingredientSlots.findIndex(slot => slot === null);
                    if (emptySlotIndex !== -1) {
                        ingredientSlots[emptySlotIndex] = itemId;
                        renderEnchantmentUI();
                    }
                };
                inventoryContainer.appendChild(card);
            }
        });
        mainPanel.appendChild(inventoryContainer);
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'enchant-controls';
        
        // Determine dynamic color
        let dynamicColor = '#98FB98';
        if (successRate < 30) dynamicColor = '#ff4136';
        else if (successRate < 70) dynamicColor = '#FFD700';

        // Success Rate Text
        const rateDiv = document.createElement('div');
        rateDiv.style.marginBottom = '10px';
        rateDiv.innerHTML = `<strong style="font-size: 1.4em; color: ${dynamicColor};">Success Rate: ${successRate.toFixed(0)}%</strong>`;
        controlsContainer.appendChild(rateDiv);
        
        // Progress Bar
        const barContainer = document.createElement('div');
        barContainer.className = 'progress-bar-container';
        const barFill = document.createElement('div');
        barFill.className = 'progress-bar-fill';
        barFill.style.width = `${successRate}%`;
        barFill.style.backgroundColor = dynamicColor;
        
        barContainer.appendChild(barFill);
        controlsContainer.appendChild(barContainer);

        const enchantBtn = document.createElement('button');
        enchantBtn.className = 'modal-action-button';
        enchantBtn.textContent = 'ENCHANT';
        enchantBtn.style.marginTop = '15px';
        enchantBtn.style.fontWeight = 'bold';
        enchantBtn.style.fontSize = '1.2em';
        enchantBtn.style.backgroundColor = '#f0f0f0';
        enchantBtn.style.color = '#1a1a1a';
        enchantBtn.disabled = totalEP === 0;
        enchantBtn.onclick = handleEnchant;

        controlsContainer.appendChild(enchantBtn);
        mainPanel.appendChild(controlsContainer);
    } else {
        const maxDiv = document.createElement('div');
        maxDiv.style.marginTop = '20px';
        maxDiv.style.fontSize = '1.5em';
        maxDiv.style.fontWeight = 'bold';
        maxDiv.style.color = '#FFD700';
        maxDiv.textContent = 'MAX LEVEL REACHED';
        mainPanel.appendChild(maxDiv);
    }

    if (enchantmentResult) {
        const overlay = document.createElement('div');
        overlay.className = 'enchant-result-overlay';
        if (enchantmentResult.success) {
            overlay.innerHTML = `
                <div class="enchant-result-text success">SUCCESS!</div>
                <div class="enchant-result-bonus">${enchantmentResult.detailText}</div>
            `;
        } else {
            overlay.innerHTML = `<div class="enchant-result-text failure">FAILURE!</div>`;
        }
        mainPanel.style.position = 'relative';
        mainPanel.appendChild(overlay);

        setTimeout(() => {
            enchantmentResult = null;
            renderEnchantmentUI();
        }, 2500);
    }
}
