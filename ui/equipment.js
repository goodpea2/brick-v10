// ui/equipment.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { EQUIPMENT_SLOT_COSTS, UNLOCK_LEVELS } from '../balancing.js';

let selectedItem = null; // { item, source: 'inventory' | 'equipped', instanceId?, slotIndex? }
let hintState = 'none'; // 'none' | 'select_item'
let gameController = null;

function getGameController() {
    return state.p5Instance; 
}

function showTooltip(item, element) {
    if (!item || !dom.ballTooltip || !element) return;
    
    // Repurpose ballTooltip for equipment
    dom.ballTooltip.className = `rarity-${item.rarity}`;
    
    let trialNote = '';
    if (state.gameMode === 'trialRun') {
        trialNote = `<div style="color: #ffaa00; font-size: 0.9em; margin-top: 5px; font-style: italic;">Consumable in Trial Run (1 Use)</div>`;
    }

    dom.ballTooltip.innerHTML = `
        <div class="tooltip-header" style="margin-bottom: 4px;">
            <span class="tooltip-name rarity-${item.rarity}" style="font-weight:bold;">${item.name}</span>
            <span class="tooltip-rarity rarity-${item.rarity}" style="font-size:0.8em; opacity:0.8; margin-left:10px;">${item.rarity}</span>
        </div>
        <div class="tooltip-effect" style="color:#98FB98; font-size:1.1em; margin: 4px 0;">${item.effectText}</div>
        <div class="tooltip-desc" style="font-size:0.9em; color:#ccc;">${item.description}</div>
        ${trialNote}
    `;

    // Make it visible
    dom.ballTooltip.style.visibility = 'visible';
    dom.ballTooltip.style.opacity = '1';

    // Positioning Logic (Mirroring showBallTooltip)
    const rect = element.getBoundingClientRect();
    const tooltipRect = dom.ballTooltip.getBoundingClientRect();
    const isLandscape = window.innerWidth > window.innerHeight;

    let top, left;

    if (isLandscape) {
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + 10;
    } else {
        top = rect.top - tooltipRect.height - 10;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    }

    // Boundary checks
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth - 5) left = window.innerWidth - tooltipRect.width - 5;
    if (top < 5) top = 5;
    if (top + tooltipRect.height > window.innerHeight - 5) top = window.innerHeight - tooltipRect.height - 5;
    
    dom.ballTooltip.style.top = `${top}px`;
    dom.ballTooltip.style.left = `${left}px`;
}

function hideTooltip() {
    if (!dom.ballTooltip) return;
    dom.ballTooltip.style.visibility = 'hidden';
    dom.ballTooltip.style.opacity = '0';
}

function findEquippedItemOwner(itemId) {
    // Iterate state.ballEquipment keys which can be types or instance IDs
    for (const key in state.ballEquipment) {
        if (state.ballEquipment[key].some(item => item && item.id === itemId)) {
            // Try to resolve instance name if key is an ID
            const instance = state.ballInventory.find(b => b.instanceId === key);
            if (instance) return instance.name;
            return key; // Fallback to type or raw key
        }
    }
    return null;
}

export function renderEquipmentUI() {
    dom.equipmentBallSlotsContainer.innerHTML = '';
    dom.equipmentInventoryContainer.innerHTML = '';
    
    const hintEl = document.getElementById('equipment-hint-text') || document.createElement('div');
    hintEl.id = 'equipment-hint-text';
    
    if (state.gameMode === 'trialRun') {
        hintEl.innerHTML = `<span style="color: #ffaa00;">⚠️ Trial Run: Equipment is consumable (1 Turn)</span>`;
        if (hintState === 'select_item') {
            hintEl.innerHTML += '<br>↓ Select an equipment to place ↓';
        }
        dom.equipmentDivider.appendChild(hintEl);
    } else if (hintState === 'select_item') {
        hintEl.textContent = '↓ Select an equipment from your inventory to place here ↓';
        dom.equipmentDivider.appendChild(hintEl);
    } else {
        hintEl.remove();
    }

    // Top panel: Render slots based on CURRENT LOADOUT
    // This allows equipping items specifically to the balls you are bringing into the run
    state.currentLoadout.forEach((instanceId, slotIndex) => {
        // If slot is empty, show empty placeholder row? Or skip?
        // Let's show empty placeholder row so player knows they have an empty slot in roster
        let ballInstance = null;
        let ballType = 'unknown';
        
        if (instanceId) {
            ballInstance = state.ballInventory.find(b => b.instanceId === instanceId);
            if (ballInstance) ballType = ballInstance.type;
        }

        const row = document.createElement('div');
        row.className = 'ball-equipment-row';
        
        // Visual
        const visual = document.createElement('div');
        visual.className = 'ball-visual';
        
        if (ballInstance) {
            const selectorBtn = document.querySelector(`.ball-select-btn[data-ball-type="${ballType}"] .ball-visual`);
            if (selectorBtn) {
                visual.style.backgroundImage = selectorBtn.style.backgroundImage;
                visual.style.backgroundSize = 'contain';
            }
        } else {
            visual.style.border = '2px dashed #555';
            visual.innerHTML = '<span style="display:flex;justify-content:center;align-items:center;height:100%;color:#555;font-size:10px;">EMPTY</span>';
        }
        
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'ball-equipment-slots';

        // Only render equipment slots if there is a ball in this loadout slot
        if (ballInstance) {
            // Determine equipment key: Use Instance ID
            const equipKey = ballInstance.instanceId;
            
            // Lazy init equipment array for this instance if missing
            if (!state.ballEquipment[equipKey]) {
                state.ballEquipment[equipKey] = [null, null, null];
            }

            const unlockedCount = state.unlockedSlots[ballType] || 1;

            for (let i = 0; i < 3; i++) {
                if (i < unlockedCount) {
                    const slot = document.createElement('div');
                    slot.className = 'equipment-slot';
                    const equippedItem = state.ballEquipment[equipKey][i];

                    if (equippedItem) {
                        slot.classList.add(`rarity-${equippedItem.rarity}`);
                        slot.innerHTML = `<span class="equipment-icon">${equippedItem.icon}</span>`;
                    }
                    
                    slot.addEventListener('mouseenter', () => showTooltip(equippedItem, slot));
                    slot.addEventListener('mouseleave', hideTooltip);

                    slot.onclick = () => {
                        if (equippedItem) { // Clicked a filled slot -> Select it (to remove/move)
                            selectedItem = { item: equippedItem, source: 'equipped', instanceId: equipKey, slotIndex: i };
                            hintState = 'none';
                            sounds.buttonClick();
                        } else { // Clicked an empty slot
                            if (selectedItem?.source === 'inventory' || selectedItem?.source === 'equipped') {
                                // Equip item
                                const { item } = selectedItem;

                                // Unequip from wherever it was
                                for (const key in state.ballEquipment) {
                                    const idx = state.ballEquipment[key].findIndex(eq => eq && eq.id === item.id);
                                    if (idx !== -1) state.ballEquipment[key][idx] = null;
                                }
                        
                                // Equip to new slot
                                state.ballEquipment[equipKey][i] = item;
                                
                                selectedItem = null;
                                hintState = 'none';
                                sounds.selectBall();
                                
                                const p = getGameController();
                                if (p && p.recalculateActiveBallStats) p.recalculateActiveBallStats();
                            } else {
                                // No item selected, show hint
                                selectedItem = null;
                                hintState = 'select_item';
                                sounds.buttonClick();
                            }
                        }
                        renderEquipmentUI();
                    };
                    slotsContainer.appendChild(slot);
                } else if (i === unlockedCount) {
                    // Unlock button (Global per type)
                    if (i === 2 && state.mainLevel < UNLOCK_LEVELS.EQUIPMENT_SLOT_3) continue;

                    const slot = document.createElement('div');
                    slot.className = 'equipment-slot-buy';
                    const cost = EQUIPMENT_SLOT_COSTS[i + 1];
                    const canAfford = state.playerGems >= cost;
                    
                    slot.innerHTML = `<button class="buy-slot-btn" ${!canAfford ? 'disabled' : ''}>Unlock<br>${cost} 💎</button>`;
                    
                    const buyBtn = slot.querySelector('.buy-slot-btn');
                    buyBtn.onclick = () => {
                        if (canAfford) {
                            state.playerGems -= cost;
                            // Initialize logic to handle new types that might be undefined
                            state.unlockedSlots[ballType] = (state.unlockedSlots[ballType] || 1) + 1;
                            sounds.upgrade();
                            renderEquipmentUI();
                        }
                    };
                    slotsContainer.appendChild(slot);
                }
            }
        } else {
            // Empty loadout slot placeholder text
            const msg = document.createElement('div');
            msg.style.color = '#555';
            msg.style.fontSize = '0.8em';
            msg.style.fontStyle = 'italic';
            msg.textContent = "Assign ball in Roster";
            slotsContainer.appendChild(msg);
        }
        
        const actionContainer = document.createElement('div');
        actionContainer.className = 'ball-equipment-action-container';
        
        if (ballInstance) {
            const equipKey = ballInstance.instanceId;
            const unlockedCount = state.unlockedSlots[ballType] || 1;
            const hasEmptySlots = state.ballEquipment[equipKey].slice(0, unlockedCount).some(slot => !slot);

            if (selectedItem?.source === 'inventory' && hasEmptySlots) {
                const equipBtn = document.createElement('button');
                equipBtn.className = 'equipment-action-btn';
                equipBtn.textContent = 'Equip';
                equipBtn.onclick = (e) => {
                    e.stopPropagation();
                    const nextEmptySlot = state.ballEquipment[equipKey].findIndex((slot, idx) => !slot && idx < unlockedCount);
                    if (nextEmptySlot !== -1) {
                        // Unequip from elsewhere
                        for (const key in state.ballEquipment) {
                            const idx = state.ballEquipment[key].findIndex(eq => eq && eq.id === selectedItem.item.id);
                            if (idx !== -1) state.ballEquipment[key][idx] = null;
                        }
                        // Equip
                        state.ballEquipment[equipKey][nextEmptySlot] = selectedItem.item;
                        selectedItem = null;
                        hintState = 'none';
                        sounds.selectBall();
                        
                        const p = getGameController();
                        if (p && p.recalculateActiveBallStats) p.recalculateActiveBallStats();
                        
                        renderEquipmentUI();
                    }
                };
                actionContainer.appendChild(equipBtn);
            } else if (selectedItem?.source === 'equipped' && selectedItem.instanceId === equipKey) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'equipment-action-btn remove';
                removeBtn.textContent = 'Remove';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    state.ballEquipment[equipKey][selectedItem.slotIndex] = null;
                    selectedItem = null;
                    hintState = 'none';
                    sounds.popupClose();
                    
                    const p = getGameController();
                    if (p && p.recalculateActiveBallStats) p.recalculateActiveBallStats();
                    
                    renderEquipmentUI();
                };
                actionContainer.appendChild(removeBtn);
            }
        }

        row.appendChild(visual);
        row.appendChild(slotsContainer);
        row.appendChild(actionContainer);
        dom.equipmentBallSlotsContainer.appendChild(row);
    });

    // Bottom panel: Inventory
    state.playerEquipment.forEach(item => {
        const card = document.createElement('div');
        card.className = `equipment-card-inv rarity-${item.rarity}`;
        card.innerHTML = `<span class="equipment-icon">${item.icon}</span>`;
        
        const equippedBy = findEquippedItemOwner(item.id);
        if (equippedBy) {
            card.classList.add('equipped-in-inventory');
        }

        if (selectedItem?.source === 'inventory' && selectedItem.item.id === item.id) {
            card.classList.add('selected');
        }
        
        card.addEventListener('mouseenter', () => showTooltip(item, card));
        card.addEventListener('mouseleave', hideTooltip);

        card.onclick = () => {
            if (selectedItem?.source === 'inventory' && selectedItem.item.id === item.id) {
                selectedItem = null; // Deselect
                hintState = 'none';
                sounds.popupClose();
            } else {
                selectedItem = { item, source: 'inventory' };
                hintState = 'none';
                sounds.buttonClick();
            }
            renderEquipmentUI();
        };
        dom.equipmentInventoryContainer.appendChild(card);
    });
}