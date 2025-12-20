// ui/ballRoster.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { ROSTER_CONSTANTS, ENCHANTMENT_OUTCOMES, BALL_STATS, HOME_BASE_PRODUCTION, BALL_FAMILIES, SUMMON_WEIGHTS, UNLOCK_LEVELS } from '../balancing.js';
import { sounds } from '../sfx.js';
import { openEnchantmentModal } from './enchantment.js';
import * as event from '../eventManager.js';
import { BALL_TEXT } from '../text.js';
import * as ui from './index.js';

let ballVisuals = {};
let gameController = null;
let selectedBallInstance = null; // Can be from inventory or slot
let selectedSource = null; // 'inventory' or 'slot'
let selectedSlotIndex = -1; // If source is slot

// Pending state for "Save" functionality
let pendingLoadout = [null, null, null, null, null, null, null];

const LOADOUT_SIZE = 7;
const FAMILY_ORDER = Object.keys(BALL_FAMILIES); // Use keys order from config (e.g. Classic, Split, etc.)

// Helper to determine sort weight based on Family and Tier
function getBallSortData(type) {
    for (let i = 0; i < FAMILY_ORDER.length; i++) {
        const familyName = FAMILY_ORDER[i];
        const family = BALL_FAMILIES[familyName];
        
        // Is it the root ball?
        if (family.root === type) {
            return { familyIndex: i, tierIndex: 0 };
        }
        
        // Is it a child ball?
        const childIndex = family.children.indexOf(type);
        if (childIndex !== -1) {
            return { familyIndex: i, tierIndex: childIndex + 1 };
        }
    }
    // Fallback for types not in families (e.g. Giant or new unmapped ones)
    return { familyIndex: 999, tierIndex: 0 }; 
}

function calculateScrapValue(ball) {
    if (!ball) return { shells: 0, essence: 0 };
    
    // Base amount from tier
    const stats = BALL_STATS.types[ball.type];
    const tier = stats ? stats.evoTier : 1;
    const baseAmount = ROSTER_CONSTANTS.SCRAP_BASE_AMOUNT[tier] || 1;
    
    // Enchantment Bonus
    const levelIndex = Math.min(ball.level - 1, ROSTER_CONSTANTS.SCRAP_ENCHANTMENT_BONUS.length - 1);
    const enchantBonus = ROSTER_CONSTANTS.SCRAP_ENCHANTMENT_BONUS[levelIndex] || 0;
    
    const totalShells = baseAmount + enchantBonus;
    const totalEssence = ROSTER_CONSTANTS.SCRAP_REWARD_ESSENCE;
    
    return { shells: totalShells, essence: totalEssence };
}

export function initialize(controller, visuals) {
    gameController = controller;
    ballVisuals = visuals;

    dom.ballRosterBtn.addEventListener('click', () => {
        sounds.popupOpen();
        if (state.p5Instance) state.p5Instance.isModalOpen = true;
        
        // Init pending loadout with current
        pendingLoadout = [...state.currentLoadout];
        
        // Reset selection on open
        resetSelection();
        
        renderBallRosterUI();
        dom.ballRosterModal.classList.remove('hidden');
    });

    dom.ballRosterModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.ballRosterModal.classList.add('hidden');
        hideActionMenu();
        ui.hideBallTooltip();
        resetSelection();
    });
    
    // Listen for upgrades to refresh UI if open
    event.subscribe('BallUpgraded', () => {
        if (!dom.ballRosterModal.classList.contains('hidden')) {
            renderBallRosterUI();
        }
    });
    
    // Summon Modal Logic
    const openSummonBtn = document.getElementById('openSummonModalBtn');
    if (openSummonBtn) {
        openSummonBtn.addEventListener('click', () => {
            sounds.buttonClick();
            updateSummonUI();
            dom.ballSummonModal.classList.remove('hidden');
        });
    }
    
    dom.ballSummonModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        dom.ballSummonModal.classList.add('hidden');
        renderBallRosterUI(); // Refresh roster in case of summon
    });
    
    const summonActionBtn = document.getElementById('summonActionBtn');
    if (summonActionBtn) {
        summonActionBtn.onclick = handleSummon;
    }
    
    // Scrap Modal Logic
    const scrapModal = document.getElementById('scrapConfirmationModal');
    if (scrapModal) {
        const confirmBtn = document.getElementById('confirmScrapBtn');
        const cancelBtn = document.getElementById('cancelScrapBtn');
        
        confirmBtn.onclick = executeScrap;
        cancelBtn.onclick = () => {
            sounds.popupClose();
            scrapModal.classList.add('hidden');
        };
    }
    
    // Close Action Menu when clicking outside
    // ALSO Deselect if clicking outside cards
    window.addEventListener('click', (e) => {
        if (!dom.ballRosterModal.classList.contains('hidden')) {
            const isClickInsideCard = e.target.closest('.roster-ball-card') || e.target.closest('.roster-slot-btn');
            const isClickInsideMenu = e.target.closest('#ballActionMenu');
            
            // If clicking outside cards/slots and outside menu, clear selection
            if (!isClickInsideCard && !isClickInsideMenu) {
                hideActionMenu();
                if (selectedBallInstance) {
                    resetSelection();
                    renderBallRosterUI();
                }
            } else if (!isClickInsideMenu) {
                // If clicking a card but not the menu, hide menu (the card click handler might reopen it if needed)
                hideActionMenu();
            }
        }
    });
}

function resetSelection() {
    selectedBallInstance = null;
    selectedSource = null;
    selectedSlotIndex = -1;
}

export function setBallRosterVisuals(visuals) {
    ballVisuals = visuals;
}

// Generate a new blank ball instance
export function createBallInstance(type) {
    const textData = BALL_TEXT[type] || { name: type + " Ball" };
    return {
        instanceId: crypto.randomUUID(),
        type: type,
        name: textData.name,
        level: 1,
        outcomes: [],
        costMultipliers: [], // Stores normalized (0-1) random rolls for cost increase per level
        stats: {}, // Calculated dynamically
        isFavorite: false,
        obtainedAt: Date.now()
    };
}

export function calculateProductionCost(ballInstance) {
    let cost = HOME_BASE_PRODUCTION.BALL_COST_FOOD;
    if (!ballInstance) return cost;

    // Calculate cost based on level and specific multipliers
    const requiredMultipliers = ballInstance.level - 1;
    const currentMultipliers = ballInstance.costMultipliers || [];

    for (let i = 0; i < requiredMultipliers; i++) {
        // Use stored multiplier or default to 0.5 (22.5% increase) if missing (legacy/migration)
        const multNormalized = (i < currentMultipliers.length) ? currentMultipliers[i] : 0.5;
        // Range: 15% (0.0) to 30% (1.0)
        const increasePercent = 0.15 + (multNormalized * 0.15);
        cost = cost * (1 + increasePercent);
    }

    return Math.round(cost);
}

// Returns { netCost: number }
// Net Cost positive means player pays. Negative means refund.
function calculateRosterChangeCost() {
    if (!gameController) return { netCost: 0 };
    
    let netCost = 0;
    const homeBaseBricks = gameController.getHomeBaseBricks();
    const board = gameController.getBoard();
    if (!homeBaseBricks || !board) return { netCost: 0 };

    // 1. Scan HomeBase for all existing balls (Cages and Producers)
    // We need to count how many of each ball type the player currently possesses.
    const ballCounts = {}; // { ballType: count }
    const processed = new Set();
    
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                
                if (brick.type === 'EmptyCage') {
                    brick.inventory.forEach(type => {
                        ballCounts[type] = (ballCounts[type] || 0) + 1;
                    });
                } else if (brick.type === 'BallProducer') {
                    if (brick.heldBall) {
                        ballCounts[brick.heldBall] = (ballCounts[brick.heldBall] || 0) + 1;
                    }
                    if (brick.production.type && brick.production.queueCount > 0) {
                         ballCounts[brick.production.type] = (ballCounts[brick.production.type] || 0) + brick.production.queueCount;
                    }
                }
            }
        }
    }

    // 2. For each ball type found, determine cost difference
    for (const [type, count] of Object.entries(ballCounts)) {
        if (count <= 0) continue;

        // Find the instance ID associated with this type in the OLD (Current) loadout
        const oldInstanceId = state.currentLoadout.find(id => {
            if(!id) return false;
            const b = state.ballInventory.find(bi => bi.instanceId === id);
            return b && b.type === type;
        });
        
        // Find the instance ID associated with this type in the NEW (Pending) loadout
        const newInstanceId = pendingLoadout.find(id => {
             if(!id) return false;
            const b = state.ballInventory.find(bi => bi.instanceId === id);
            return b && b.type === type;
        });

        // Case A: Type is completely removed in new loadout
        if (!newInstanceId) {
             // Refund full cost of old instance
             if (oldInstanceId) {
                 const oldInstance = state.ballInventory.find(b => b.instanceId === oldInstanceId);
                 const cost = calculateProductionCost(oldInstance);
                 netCost -= (cost * count);
             } else {
                 // Fallback if somehow type existed without instance in loadout (e.g. unequipped but still in cages from before?)
                 // Assume base cost refund
                 netCost -= (HOME_BASE_PRODUCTION.BALL_COST_FOOD * count);
             }
        } 
        // Case B: Type is still present (check if instance changed)
        else {
             if (oldInstanceId !== newInstanceId) {
                 // Calculate difference
                 let oldCost = HOME_BASE_PRODUCTION.BALL_COST_FOOD;
                 if (oldInstanceId) {
                     const oldInstance = state.ballInventory.find(b => b.instanceId === oldInstanceId);
                     oldCost = calculateProductionCost(oldInstance);
                 }
                 
                 const newInstance = state.ballInventory.find(b => b.instanceId === newInstanceId);
                 const newCost = calculateProductionCost(newInstance);
                 
                 netCost += (newCost - oldCost) * count;
             }
        }
    }
    
    return { netCost };
}

function handleSaveRoster() {
    const { netCost } = calculateRosterChangeCost();
    
    // Check affordability if cost is positive
    if (netCost > 0 && state.playerFood < netCost) {
         if(gameController?.addFloatingText) gameController.addFloatingText("Not enough food!", {levels: [255,100,100]}, {isBold: true});
         return;
    }

    // Apply transaction
    state.playerFood -= netCost;
    if (netCost !== 0) {
        const color = netCost > 0 ? {levels:[255,100,100]} : {levels:[100,255,100]};
        const sign = netCost > 0 ? '-' : '+';
        if(gameController?.addFloatingText) gameController.addFloatingText(`${sign}${Math.abs(netCost)} 🥕`, color, {isBold: true});
    }

    // Process removals (Clear balls from cages/producers if type is removed)
    const homeBaseBricks = gameController.getHomeBaseBricks();
    const board = gameController.getBoard();
    const processed = new Set();
    
    const allowedTypes = new Set();
    pendingLoadout.forEach(id => {
        if (!id) return;
        const b = state.ballInventory.find(bi => bi.instanceId === id);
        if(b) allowedTypes.add(b.type);
    });

    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                
                if (brick.type === 'EmptyCage') {
                    // Filter inventory
                    const originalLen = brick.inventory.length;
                    brick.inventory = brick.inventory.filter(type => allowedTypes.has(type));
                    // Diff handled in cost calculation
                } else if (brick.type === 'BallProducer') {
                    if (brick.heldBall && !allowedTypes.has(brick.heldBall)) {
                        brick.heldBall = null;
                        brick.production.progress = 0;
                    }
                    if (brick.production.type && !allowedTypes.has(brick.production.type)) {
                        brick.production.queueCount = 0;
                        brick.production.type = null;
                        brick.production.progress = 0;
                    }
                }
            }
        }
    }

    // Commit Loadout
    state.currentLoadout = [...pendingLoadout];
    
    sounds.upgrade(); // Save sound
    renderBallRosterUI();
    
    if(state.p5Instance && state.p5Instance.recalculateActiveBallStats) {
        state.p5Instance.recalculateActiveBallStats();
    }
}

function handleInventoryClick(ball) {
    sounds.selectBall();
    selectedBallInstance = ball;
    selectedSource = 'inventory';
    selectedSlotIndex = -1;
    
    // Re-render to show selection highlight
    renderBallRosterUI();
    
    // Find the new element after render
    // Use setTimeout to ensure DOM update and layout reflow has occurred
    setTimeout(() => {
        const newCard = document.querySelector(`.roster-ball-card[data-instance-id="${ball.instanceId}"]`);
        if (newCard) {
            showActionMenu(ball, newCard, 'inventory');
        }
    }, 0);
}

function handleSlotClick(slotIndex, equippedInstance, element) {
    // SCENARIO 1: Inventory Item Selected -> Clicking Slot (Equip/Swap)
    if (selectedSource === 'inventory' && selectedBallInstance) {
        
        // Check if trying to equip same instance
        if (equippedInstance && equippedInstance.instanceId === selectedBallInstance.instanceId) {
             resetSelection();
             renderBallRosterUI();
             return;
        }

        // Unique Type Check: Enforce one ball per type in loadout
        const typeToEquip = selectedBallInstance.type;
        const existingIndex = pendingLoadout.findIndex(id => {
            if(!id) return false;
            const b = state.ballInventory.find(bi => bi.instanceId === id);
            return b && b.type === typeToEquip;
        });

        // If same type exists elsewhere, remove it first
        if (existingIndex !== -1 && existingIndex !== slotIndex) {
             pendingLoadout[existingIndex] = null; 
        }
        
        // Remove from old slot if already equipped elsewhere (instance check)
        const existingSlotIndex = pendingLoadout.indexOf(selectedBallInstance.instanceId);
        if (existingSlotIndex !== -1) {
            pendingLoadout[existingSlotIndex] = null;
        }
        
        // Set new slot
        pendingLoadout[slotIndex] = selectedBallInstance.instanceId;
        
        sounds.selectBall(); 
        hideActionMenu();
        resetSelection();
        renderBallRosterUI();

    } 
    // SCENARIO 2: Equipped Slot Selected -> Clicking DIFFERENT Slot (Move/Swap)
    else if (selectedSource === 'slot' && selectedBallInstance) {
        
        // If clicking same slot, just re-open menu
        if (selectedSlotIndex === slotIndex) {
            showActionMenu(selectedBallInstance, element, 'slot');
            return;
        }
        
        // Moving from selectedSlotIndex to slotIndex
        const ballToMove = selectedBallInstance;
        const ballAtTarget = pendingLoadout[slotIndex];
        
        pendingLoadout[slotIndex] = ballToMove.instanceId;
        pendingLoadout[selectedSlotIndex] = ballAtTarget; 
        
        sounds.selectBall();
        hideActionMenu();
        resetSelection();
        renderBallRosterUI();

    }
    // SCENARIO 3: Nothing Selected -> Clicking Slot (Select)
    else if (equippedInstance) {
        sounds.selectBall();
        selectedBallInstance = equippedInstance;
        selectedSource = 'slot';
        selectedSlotIndex = slotIndex;
        
        // Render first to highlight
        renderBallRosterUI();
        
        // Find new element for this slot with delay
        setTimeout(() => {
            const slots = document.querySelectorAll('.roster-slot-btn');
            if (slots[slotIndex]) {
                showActionMenu(equippedInstance, slots[slotIndex], 'slot');
            }
        }, 0);
    } 
    // SCENARIO 4: Nothing Selected -> Clicking Empty Slot
    else {
        sounds.buttonClick();
    }
}

function handleUnequip() {
    if (selectedSource === 'slot' && selectedSlotIndex !== -1) {
        pendingLoadout[selectedSlotIndex] = null;
        sounds.popupClose();
        hideActionMenu();
        resetSelection();
        renderBallRosterUI();
    }
}

function handleUpgrade() {
    if (!selectedBallInstance) return;
    openEnchantmentModal(selectedBallInstance.instanceId);
    hideActionMenu();
}

function handleScrap() {
    if (!selectedBallInstance) return;
    
    // Check if equipped (if checking inventory item)
    if (selectedSource === 'inventory') {
        if (state.currentLoadout.includes(selectedBallInstance.instanceId) || pendingLoadout.includes(selectedBallInstance.instanceId)) {
            // Cannot scrap equipped or pending equipped
             return;
        }
    }
    
    // Open confirmation modal
    const scrapModal = document.getElementById('scrapConfirmationModal');
    if (scrapModal) {
        sounds.popupOpen();
        const rewards = calculateScrapValue(selectedBallInstance);
        const rewardText = scrapModal.querySelector('div[style*="margin: 15px"]');
        if (rewardText) {
            rewardText.innerHTML = `
                You will receive: <br>
                <span style="color: #FFD700; font-weight: bold;">${rewards.shells} Shells 🐚</span> + 
                <span style="color: #00e5ff; font-weight: bold;">${rewards.essence} Essence</span>
            `;
        }
        scrapModal.classList.remove('hidden');
    }
    hideActionMenu();
}

function executeScrap() {
    const scrapModal = document.getElementById('scrapConfirmationModal');
    if (!selectedBallInstance) {
        if (scrapModal) scrapModal.classList.add('hidden');
        return;
    }

    const instanceIndex = state.ballInventory.findIndex(b => b.instanceId === selectedBallInstance.instanceId);
    if (instanceIndex === -1) {
        if (scrapModal) scrapModal.classList.add('hidden');
        return;
    }

    // Safety: ensure not in pending loadout
    if (pendingLoadout.includes(selectedBallInstance.instanceId)) {
        if (scrapModal) scrapModal.classList.add('hidden');
        return;
    }

    const rewards = calculateScrapValue(selectedBallInstance);
    
    state.ballInventory.splice(instanceIndex, 1);
    state.playerShells += rewards.shells;
    state.playerBallEssence += rewards.essence;
    
    resetSelection();
    
    sounds.coin(); // Reuse coin sound for scrapping
    
    if (scrapModal) scrapModal.classList.add('hidden');
    renderBallRosterUI();
    ui.hideBallTooltip(); 
}

function updateSummonUI() {
    const shellCountEl = document.getElementById('summonShellCount');
    const essenceCountEl = document.getElementById('summonEssenceCount');
    const summonBtn = document.getElementById('summonActionBtn');
    
    if (shellCountEl) shellCountEl.textContent = state.playerShells;
    if (essenceCountEl) essenceCountEl.textContent = state.playerBallEssence;
    if (summonBtn) {
        summonBtn.disabled = state.playerShells < ROSTER_CONSTANTS.RANDOM_BALL_COST;
        summonBtn.textContent = `${ROSTER_CONSTANTS.RANDOM_BALL_COST} 🐚`;
    }

    renderEssenceShopUI();
}

function renderEssenceShopUI() {
    const grid = document.getElementById('essenceShopGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Get all unique types from families, excluding giant
    const types = [];
    Object.values(BALL_FAMILIES).forEach(family => {
        if (family.root !== 'giant') {
            types.push(family.root);
            if (family.children) types.push(...family.children);
        }
    });
    
    // SORTING LOGIC FOR SHOP:
    // 1. Tier 1 (Evo 1) then Tier 2 (Evo 2)
    // 2. Within each tier, use Inventory sort order (Family index)
    types.sort((a, b) => {
        const statsA = BALL_STATS.types[a];
        const statsB = BALL_STATS.types[b];
        const tierA = statsA.evoTier || 1;
        const tierB = statsB.evoTier || 1;

        if (tierA !== tierB) return tierA - tierB;
        
        const sortA = getBallSortData(a);
        const sortB = getBallSortData(b);
        return sortA.familyIndex - sortB.familyIndex;
    });

    types.forEach(type => {
        const stats = BALL_STATS.types[type];
        if (!stats) return;

        const tier = stats.evoTier || 1;
        const cost = tier === 1 ? 4 : 20;
        const canAfford = state.playerBallEssence >= cost;
        const textData = BALL_TEXT[type] || { name: type, description: '' };

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div>
                <div class="upgrade-card-header">${textData.name}</div>
                <div class="upgrade-card-stat" style="display: flex; justify-content: center; margin: 10px 0;">
                    <div class="ball-visual" style="width: 40px; height: 40px; background-image: url(${ballVisuals[type]});"></div>
                </div>
                <div style="font-size: 0.8em; color: #aaa; margin-bottom: 10px; min-height: 3.2em;">${textData.description}</div>
            </div>
            <button class="upgrade-cost-button" ${!canAfford ? 'disabled' : ''}>${cost} ✨</button>
        `;

        const buyBtn = card.querySelector('button');
        buyBtn.onclick = () => {
            if (state.playerBallEssence >= cost) {
                state.playerBallEssence -= cost;
                const newInstance = createBallInstance(type);
                state.ballInventory.push(newInstance);
                sounds.ballGained();
                updateSummonUI();
                
                // FEEDBACK
                if(gameController?.addFloatingText) {
                    gameController.addFloatingText(`Purchased ${textData.name}!`, {levels:[0, 255, 255]}, {isBold: true, size: 24, glow: true});
                }
            }
        };

        grid.appendChild(card);
    });
}

function handleSummon() {
    if (state.playerShells < ROSTER_CONSTANTS.RANDOM_BALL_COST) return;
    
    // 1. Deduct cost
    state.playerShells -= ROSTER_CONSTANTS.RANDOM_BALL_COST;
    
    // 2. Determine type (Weighted)
    const types = Object.keys(SUMMON_WEIGHTS);
    const totalWeight = types.reduce((sum, t) => sum + (SUMMON_WEIGHTS[t] || 0), 0);
    let r = Math.random() * totalWeight;
    let randomType = types[0];
    
    for (const t of types) {
        const w = SUMMON_WEIGHTS[t] || 0;
        if (r < w) {
            randomType = t;
            break;
        }
        r -= w;
    }
    
    // 3. Create Instance
    const newBall = createBallInstance(randomType);
    state.ballInventory.push(newBall);
    
    // 4. Feedback
    sounds.ballGained();
    updateSummonUI();
    
    const resultContainer = document.getElementById('summonResultContainer');
    const visualContainer = document.getElementById('summonResultVisual');
    const nameEl = document.getElementById('summonResultName');
    
    resultContainer.classList.remove('hidden');
    nameEl.textContent = newBall.name;
    
    visualContainer.innerHTML = '';
    const visual = document.createElement('div');
    visual.className = 'ball-visual';
    if (ballVisuals[randomType]) {
        visual.style.backgroundImage = `url(${ballVisuals[randomType]})`;
    }
    visualContainer.appendChild(visual);
}

function showActionMenu(ball, element, source) {
    const menu = dom.ballActionMenu;
    if (!menu || !element) return;

    menu.innerHTML = '';
    
    // UPGRADE Button (Always available in action menu if ball exists)
    const upgradeBtn = document.createElement('button');
    upgradeBtn.className = 'btn-action-upgrade';
    upgradeBtn.textContent = 'UPGRADE';
    upgradeBtn.onclick = (e) => {
        e.stopPropagation();
        handleUpgrade();
    };
    menu.appendChild(upgradeBtn);
    
    // Level 28 locks EQUIP/UNEQUIP and SCRAP
    if (state.mainLevel >= UNLOCK_LEVELS.BALL_SUMMON) {
        // EQUIP Button (Only if source is inventory and not equipped in pending)
        if (source === 'inventory') {
            const isEquipped = pendingLoadout.includes(ball.instanceId);
            
            if (!isEquipped) {
                const equipBtn = document.createElement('button');
                equipBtn.className = 'btn-action-use';
                equipBtn.textContent = 'EQUIP';
                
                // Check if slots full
                const firstEmptySlot = pendingLoadout.indexOf(null);
                if (firstEmptySlot === -1) {
                    // If full, do nothing (click acts as hint?)
                    equipBtn.onclick = (e) => { e.stopPropagation(); hideActionMenu(); };
                } else {
                    equipBtn.onclick = (e) => {
                        e.stopPropagation();
                        
                        // Unique Type Check on Inventory Equip
                        const typeToEquip = ball.type;
                        const existingIndex = pendingLoadout.findIndex(id => {
                            if(!id) return false;
                            const b = state.ballInventory.find(bi => bi.instanceId === id);
                            return b && b.type === typeToEquip;
                        });
                        
                        if (existingIndex !== -1) {
                            pendingLoadout[existingIndex] = null; // Remove old
                        }

                        // Equip to first empty
                        pendingLoadout[firstEmptySlot] = ball.instanceId;
                        sounds.selectBall();
                        hideActionMenu();
                        resetSelection();
                        renderBallRosterUI();
                    };
                }
                menu.appendChild(equipBtn);
            } else {
                // UNEQUIP if inventory click on equipped item
                const unequipBtn = document.createElement('button');
                unequipBtn.className = 'btn-action-use';
                unequipBtn.textContent = 'UNEQUIP';
                unequipBtn.onclick = (e) => {
                    e.stopPropagation();
                    const slotIdx = pendingLoadout.indexOf(ball.instanceId);
                    if (slotIdx !== -1) {
                        pendingLoadout[slotIdx] = null;
                        sounds.popupClose();
                        hideActionMenu();
                        resetSelection();
                        renderBallRosterUI();
                    }
                };
                menu.appendChild(unequipBtn);
            }
        }

        // UNEQUIP Button (Only if source is slot)
        if (source === 'slot') {
            const unequipBtn = document.createElement('button');
            unequipBtn.className = 'btn-action-use';
            unequipBtn.textContent = 'UNEQUIP';
            unequipBtn.onclick = (e) => {
                e.stopPropagation();
                handleUnequip();
            };
            menu.appendChild(unequipBtn);
        } 
        
        // SCRAP Button
        const scrapBtn = document.createElement('button');
        scrapBtn.className = 'btn-action-scrap';
        scrapBtn.textContent = 'SCRAP';
        
        // Validation: Cannot scrap if equipped (if source is inventory, check global loadout or pending)
        let isEquipped = pendingLoadout.includes(ball.instanceId);
        
        if (isEquipped) {
            scrapBtn.disabled = true;
            scrapBtn.style.opacity = '0.5';
            scrapBtn.title = "Cannot scrap equipped ball";
        }
        
        scrapBtn.onclick = (e) => {
            e.stopPropagation();
            handleScrap();
        };
        menu.appendChild(scrapBtn);
    }

    menu.classList.remove('hidden');
    menu.style.position = 'fixed'; 

    // Position Menu
    const rect = element.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect(); 
    
    // Force a reflow or use hardcoded approx height if rect is 0
    let menuHeight = menuRect.height || 150; 
    let menuWidth = menuRect.width || 120;

    let top = rect.bottom + 5;
    let left = rect.left + (rect.width / 2) - (menuWidth / 2);

    // If menu goes off bottom, flip to top
    if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 5; 
    }
    
    // Horizontal bounds
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

function hideActionMenu() {
    const menu = dom.ballActionMenu;
    if (menu) menu.classList.add('hidden');
}

export function renderBallRosterUI() {
    const loadoutRow = dom.rosterLoadoutRow;
    const inventoryGrid = dom.rosterInventoryGrid;
    
    loadoutRow.innerHTML = '';
    inventoryGrid.innerHTML = '';
    
    ui.hideBallTooltip();

    // Toggle Summon Button based on Level 28
    const openSummonBtn = document.getElementById('openSummonModalBtn');
    if (openSummonBtn) {
        openSummonBtn.style.display = (state.mainLevel >= UNLOCK_LEVELS.BALL_SUMMON) ? 'block' : 'none';
    }

    // --- 1. Top Loadout Row (7 Fixed Slots) ---
    for (let i = 0; i < LOADOUT_SIZE; i++) {
        const slotBtn = document.createElement('div');
        slotBtn.className = 'roster-slot-btn';
        
        const equippedId = pendingLoadout[i];
        
        if (equippedId) {
            const equippedInstance = state.ballInventory.find(b => b.instanceId === equippedId);
            
            if (equippedInstance) {
                const visual = document.createElement('div');
                visual.className = 'ball-visual';
                if (ballVisuals[equippedInstance.type]) {
                    visual.style.backgroundImage = `url(${ballVisuals[equippedInstance.type]})`;
                }
                slotBtn.appendChild(visual);
                
                const badge = document.createElement('div');
                badge.className = 'ball-level-badge';
                badge.textContent = `Lv.${equippedInstance.level}`;
                slotBtn.appendChild(badge);
                
                if (selectedSource === 'slot' && selectedSlotIndex === i) {
                    slotBtn.classList.add('active');
                }

                slotBtn.addEventListener('mouseenter', () => ui.showBallTooltip(equippedInstance.type, slotBtn, equippedInstance));
                slotBtn.addEventListener('mouseleave', ui.hideBallTooltip);
                
                slotBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleSlotClick(i, equippedInstance, slotBtn);
                };
            }
        } else {
            // Empty slot style
            slotBtn.style.borderStyle = 'dashed';
            slotBtn.style.opacity = '0.3';
            
            slotBtn.onclick = (e) => {
                e.stopPropagation();
                handleSlotClick(i, null, slotBtn);
            };
        }
        
        loadoutRow.appendChild(slotBtn);
    }
    
    // --- 1.5 Add Save Button ---
    const { netCost } = calculateRosterChangeCost();
    const saveBtn = document.createElement('button');
    saveBtn.className = 'roster-summon-btn-small';
    saveBtn.style.marginLeft = '10px';
    saveBtn.style.height = 'fit-content';
    
    if (netCost > 0) {
        saveBtn.textContent = `Save\n(-${netCost}🥕)`;
        saveBtn.style.backgroundColor = '#ff4136'; // Red warning color
        if (state.playerFood < netCost) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.title = "Not enough food!";
        }
    } else if (netCost < 0) {
        saveBtn.textContent = `Save\n(+${Math.abs(netCost)}🥕)`;
        saveBtn.style.backgroundColor = '#00e5ff'; // Profit color
    } else {
        saveBtn.textContent = 'Save';
        saveBtn.style.backgroundColor = '#98FB98'; // Green safe
    }
    
    // Check if dirty
    const isDirty = JSON.stringify(pendingLoadout) !== JSON.stringify(state.currentLoadout);
    if (!isDirty) {
        saveBtn.disabled = true;
        saveBtn.style.backgroundColor = '#555';
    }

    saveBtn.onclick = (e) => {
        e.stopPropagation();
        handleSaveRoster();
    };
    
    loadoutRow.appendChild(saveBtn);


    // --- 2. Unified Inventory Grid ---
    const allBalls = [...state.ballInventory];
    
    // --- SORTING LOGIC ---
    allBalls.sort((a, b) => {
        const sortA = getBallSortData(a.type);
        const sortB = getBallSortData(b.type);
        
        // 1. Sort by Family Order
        if (sortA.familyIndex !== sortB.familyIndex) {
            return sortA.familyIndex - sortB.familyIndex;
        }
        // 2. Sort by Tier within Family (Root = 0, Child = 1, 2, ...)
        if (sortA.tierIndex !== sortB.tierIndex) {
            return sortA.tierIndex - sortB.tierIndex;
        }
        // 3. Tie-break by Level Descending
        return b.level - a.level;
    });
    
    allBalls.forEach(ball => {
        const card = document.createElement('div');
        card.className = 'roster-ball-card';
        card.dataset.instanceId = ball.instanceId;
        
        const isEquipped = pendingLoadout.includes(ball.instanceId);
        if (isEquipped) card.classList.add('equipped');
        
        if (selectedSource === 'inventory' && selectedBallInstance && selectedBallInstance.instanceId === ball.instanceId) {
            card.classList.add('selected');
        }
        
        const visual = document.createElement('div');
        visual.className = 'ball-visual';
        if (ballVisuals[ball.type]) {
            visual.style.backgroundImage = `url(${ballVisuals[ball.type]})`;
        }
        card.appendChild(visual);
        
        const levelBadge = document.createElement('div');
        levelBadge.className = 'ball-level';
        levelBadge.textContent = `Lv.${ball.level}`;
        card.appendChild(levelBadge);
        
        card.addEventListener('mouseenter', () => {
             if (!dom.ballActionMenu.classList.contains('hidden')) return;
             ui.showBallTooltip(ball.type, card, ball);
        });
        card.addEventListener('mouseleave', ui.hideBallTooltip);
        
        card.onclick = (e) => {
            e.stopPropagation();
            if (selectedSource === 'inventory' && selectedBallInstance && selectedBallInstance.instanceId === ball.instanceId) {
                 // Clicking same selected inventory item -> Just refresh menu position
                 showActionMenu(ball, card, 'inventory');
            } else {
                handleInventoryClick(ball, card);
            }
        };
        
        inventoryGrid.appendChild(card);
    });
}
