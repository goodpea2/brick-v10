
// ui/ballSelector.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_LEVELS, BALL_STATS, ENCHANTMENT_OUTCOMES } from '../balancing.js';
import { BALL_ENCHANTMENT_DISPLAY_CONFIG } from './enchantment.js';

let lastOrderedSignature = '';

export function updateBallSelectorArrow() {
    const activeBtn = document.querySelector('.ball-select-btn.active');
    if (!activeBtn || !dom.ballSelectorArrow || activeBtn.classList.contains('hidden')) {
        if(dom.ballSelectorArrow) dom.ballSelectorArrow.style.visibility = 'hidden';
        return;
    }
    
    dom.ballSelectorArrow.style.visibility = 'visible';
    const btnRect = activeBtn.getBoundingClientRect();
    const arrowEl = dom.ballSelectorArrow;
    const isLandscape = window.innerWidth > window.innerHeight;

    arrowEl.style.transition = 'top 0.15s ease-in-out, left 0.15s ease-in-out';

    if (isLandscape) {
        // Position arrow to the left of the button, pointing right
        arrowEl.style.transform = 'rotate(-90deg)';
        const topPos = btnRect.top + btnRect.height / 2 - arrowEl.offsetHeight / 2;
        const leftPos = btnRect.left - arrowEl.offsetWidth - 5;
        arrowEl.style.top = `${topPos}px`;
        arrowEl.style.left = `${leftPos}px`;
    } else {
        // Position arrow above the button, pointing down
        arrowEl.style.transform = '';
        const topPos = btnRect.top - arrowEl.offsetHeight;
        const leftPos = btnRect.left + btnRect.width / 2 - arrowEl.offsetWidth / 2;
        arrowEl.style.top = `${topPos}px`;
        arrowEl.style.left = `${leftPos}px`;
    }
}

export function showSimpleTooltip(element, text) {
    if (!dom.ballTooltip || !element) return;
    
    // Use a simple structure for generic tooltips
    dom.ballTooltip.innerHTML = `<div class="tooltip-description">${text}</div>`;
    dom.ballTooltip.className = ''; // Reset any rarity classes

    // Positioning logic
    dom.ballTooltip.style.visibility = 'visible';
    dom.ballTooltip.style.opacity = '1';

    const elRect = element.getBoundingClientRect();
    const tooltipRect = dom.ballTooltip.getBoundingClientRect();

    let top = elRect.top - tooltipRect.height - 10; // Default above
    let left = elRect.left + (elRect.width / 2) - (tooltipRect.width / 2);
    
    // If it's one of the top-right banks, position below instead
    if (element === dom.gemBankEl || element === dom.foodBankEl || element === dom.woodBankEl) {
        top = elRect.bottom + 10;
    }

    // Boundary checks
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth - 5) {
        left = window.innerWidth - tooltipRect.width - 5;
    }
    if (top < 5) top = 5;
    if (top + tooltipRect.height > window.innerHeight - 5) {
        top = elRect.top - tooltipRect.height - 10; // Try above again if below fails
    }

    dom.ballTooltip.style.top = `${top}px`;
    dom.ballTooltip.style.left = `${left}px`;
}


export function showBallTooltip(ballType, element) {
    if (!dom.ballTooltip || !element) return;
    
    const descriptions = {
        classic: "Has 50 extra HP.",
        strong: "Evo2: Stronger base damage and HP.",
        lightning: "Evo2: Chains damage to nearby bricks.",
        explosive: "Explodes in a 2 tiles radius (2 uses)",
        draining: "Evo2: Explosion damage scales with MISSING HP (Lower HP = More Dmg).",
        spray: "Evo2: Standard explosion but has 3 uses.",
        piercing: "Phases through 5 bricks (2 uses)",
        phaser: "Evo2: Power-up ignores ALL bricks for 0.7 seconds.",
        grow: "Evo2: Ball size increases by 50% on power-up use.",
        split: "Spawns 2 smaller balls (1 use)",
        cluster: "Evo2: Spawns 4 mini-balls instead of 2.",
        cell: "Evo2: Spawns a mini-ball whenever it destroys a brick.",
        brick: "Spawn a ring of 10 HP bricks (1 use)",
        cross: "Evo2: Spawns bricks in a cross pattern across the board.",
        hollow: "Evo2: Pushes existing bricks away before spawning new ones.",
        bullet: "Fires 4 projectiles in a cross pattern (3 uses)",
        octo: "Evo2: Fires 8 projectiles in all directions.",
        gatling: "Evo2: Rapidly fires 6 projectiles in the direction of travel.",
        homing: "Fires a seeking projectile that explodes (2 uses)",
        seeker: "Evo2: Passive - Fires a homing missile whenever it destroys a brick.",
        chase: "Evo2: Redirects itself towards the Goal brick and gains damage.",
        giant: "One-shot ball that pierces all bricks but dies on wall contact. (Consumable)"
    };
    
    // Resolve specific equipped instance for accurate stats and icons
    let ballInstance = null;
    let equipmentList = [];
    
    const matchingId = state.currentLoadout.find(id => {
        if(!id) return false;
        const b = state.ballInventory.find(bi => bi.instanceId === id);
        return b && b.type === ballType;
    });
    
    if(matchingId) {
        ballInstance = state.ballInventory.find(b => b.instanceId === matchingId);
        // Get instance equipment
        equipmentList = state.ballEquipment[matchingId] || [];
    } else {
        // Fallback to type equipment
        equipmentList = state.ballEquipment[ballType] || [];
    }

    let iconsHTML = '';
    equipmentList.forEach(item => {
        if (item) {
            iconsHTML += `<span class="tooltip-equip-icon">${item.icon}</span>`;
        }
    });

    let name = ballType.charAt(0).toUpperCase() + ballType.slice(1);
    // Use instance name if available
    if (ballInstance && ballInstance.name) {
        name = ballInstance.name;
    } else {
        name = name.replace(/([A-Z])/g, ' $1').trim() + ' Ball'; // Add spaces for CamelCase
    }

    const baseStats = BALL_STATS.types[ballType];
    let statsHTML = '';

    // If we have an instance, use its specific stats. Otherwise fallback to legacy or base.
    if (ballInstance && baseStats && ballType !== 'giant') {
        const displayConfig = BALL_ENCHANTMENT_DISPLAY_CONFIG[ballType];
        
        const mockEnchData = { 
            level: ballInstance.level,
            hpMultiplier: 1.0, damageMultiplier: 1.0, bonusChainDamage: 0, 
            bonusPowerUpValue: 0, bonusEnergyShieldDuration: 0, bonusMainBallArmor: 0,
            bonusPowerUpMineCount: 0, bonusLastPowerUpBulletCount: 0, bonusHomingExplosionDamage: 0,
            outcomes: []
        };
        
        if (ballInstance.outcomes) {
            ballInstance.outcomes.forEach(key => {
                const outcome = ENCHANTMENT_OUTCOMES[ballType][key];
                if (outcome) outcome.apply(mockEnchData);
            });
        }
        
        const outcomeCounts = ballInstance.outcomes.reduce((acc, k) => { acc[k] = (acc[k]||0)+1; return acc; }, {});

        if (displayConfig) {
            statsHTML += '<ul>';
            displayConfig.forEach(statConf => {
                const currentValue = statConf.getCurrent(baseStats, mockEnchData);
                const count = outcomeCounts[statConf.key] || 0;
                const diamonds = '♦'.repeat(count);
                const diamondHtml = diamonds.length > 0 ? `<span class="tooltip-stats-diamonds">${diamonds}</span>` : '';
                
                statsHTML += `<li><span>${statConf.name}:</span> <span>${statConf.format(currentValue)}</span> ${diamondHtml}</li>`;
            });
            statsHTML += '</ul>';
        }
    } else {
        // Fallback for legacy saves or unequipped types
        const enchantmentData = state.ballEnchantments[ballType];
        if (enchantmentData && baseStats && ballType !== 'giant') {
            const displayConfig = BALL_ENCHANTMENT_DISPLAY_CONFIG[ballType];
            if (displayConfig) {
                statsHTML += '<ul>';
                displayConfig.forEach(statConf => {
                    const currentValue = statConf.getCurrent(baseStats, enchantmentData);
                    statsHTML += `<li><span>${statConf.name}:</span> <span>${statConf.format(currentValue)}</span></li>`;
                });
                statsHTML += '</ul>';
            }
        }
    }

    const levelBadge = ballInstance ? `<span style="font-size:0.8em; background:rgba(255,255,255,0.2); padding:1px 4px; border-radius:4px; margin-left:5px;">Lv${ballInstance.level}</span>` : '';
    
    // Charge cost display
    let chargeHTML = '';
    if (baseStats.launchCost > 0) {
        const canAfford = state.runCharge >= baseStats.launchCost;
        chargeHTML = `<div style="margin-top:5px; border-top:1px solid #444; padding-top:5px;">Launch Cost: <span style="color:${canAfford?'#FFD700':'#ff4136'}; font-weight:bold;">${baseStats.launchCost} ⚡️</span></div>`;
    }

    dom.ballTooltip.innerHTML = `
        <div class="tooltip-header">
            <span style="display:flex; align-items:center;">${name}${levelBadge}</span>
            <div class="tooltip-icons-container">${iconsHTML}</div>
        </div>
        <div class="tooltip-description">${descriptions[ballType] || ''}</div>
        <div class="tooltip-stats">${statsHTML}</div>
        ${chargeHTML}
    `;

    // Make it visible first to measure its dimensions correctly
    dom.ballTooltip.style.visibility = 'visible';
    dom.ballTooltip.style.opacity = '1';

    // Positioning
    const btnRect = element.getBoundingClientRect();
    const tooltipRect = dom.ballTooltip.getBoundingClientRect();
    const isLandscape = window.innerWidth > window.innerHeight;

    let top, left;

    if (isLandscape) {
        // To the right of the button
        top = btnRect.top + (btnRect.height / 2) - (tooltipRect.height / 2);
        left = btnRect.right + 10;
    } else {
        // Above the button
        top = btnRect.top - tooltipRect.height - 10;
        left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
    }

    // Boundary checks
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 5;
    if (top < 5) top = 5;
    
    dom.ballTooltip.style.top = `${top}px`;
    dom.ballTooltip.style.left = `${left}px`;
}

export function hideBallTooltip() {
    if (!dom.ballTooltip) return;
    dom.ballTooltip.style.visibility = 'hidden';
    dom.ballTooltip.style.opacity = '0';
}


export function updateBallSelectorUI(mainLevel, balls, giantBalls, gameState) {
    if (state.gameMode === 'homeBase') {
        dom.ballSelector.classList.add('hidden');
        dom.ballSelectorArrow.style.visibility = 'hidden';
        return;
    }

    // Determine visibility of the whole selector
    let totalBallsAvailable = 0;
    if (state.gameMode === 'trialRun') {
        totalBallsAvailable = Object.values(state.trialRunBallStock).reduce((sum, count) => sum + count, 0);
    } else { // adventureRun
        totalBallsAvailable = balls + giantBalls;
    }

    const showSelector = gameState === 'aiming' && totalBallsAvailable > 0 && mainLevel >= UNLOCK_LEVELS.EXPLOSIVE_BALL;

    dom.ballSelector.classList.toggle('hidden', !showSelector);
    
    // Determine ordered Types
    let orderedTypes = [];
    if (state.gameMode === 'trialRun') {
        orderedTypes = ['classic', 'explosive', 'piercing', 'split', 'brick', 'bullet', 'homing', 'strong', 'lightning', 'cluster', 'cell', 'giant', 'draining', 'spray', 'phaser', 'grow', 'cross', 'hollow', 'octo', 'gatling', 'seeker', 'chase'];
    } else { // adventureRun
         dom.runEquipmentBtn.classList.toggle('hidden', mainLevel < UNLOCK_LEVELS.EQUIPMENT);

         // Loadout Order
         const processedTypes = new Set();
         state.currentLoadout.forEach(instanceId => {
            if (!instanceId) return;
            const ballInstance = state.ballInventory.find(b => b.instanceId === instanceId);
            if (!ballInstance) return;
            if (processedTypes.has(ballInstance.type)) return;
            processedTypes.add(ballInstance.type);
            orderedTypes.push(ballInstance.type);
         });

         // Giant
         if (giantBalls > 0 && mainLevel >= UNLOCK_LEVELS.GIANT_BONUS) {
             orderedTypes.push('giant');
         }
    }

    // 1. Update Buttons State & Visibility
    const allBtns = document.querySelectorAll('.ball-select-btn');
    allBtns.forEach(btn => {
        const type = btn.dataset.ballType;
        let isVisible = false;

        if (state.gameMode === 'trialRun') {
            if (orderedTypes.includes(type) && type !== 'giant') {
                const count = state.trialRunBallStock[type] || 0;
                isVisible = count > 0;
            }
        } else {
             // Adventure
             if (orderedTypes.includes(type)) isVisible = true;
        }

        if (isVisible) {
            btn.classList.remove('hidden');
            
            // Stats check
            const stats = BALL_STATS.types[type];
            const canAfford = !stats.launchCost || state.runCharge >= stats.launchCost;
            let interactable = true;

            if (state.gameMode === 'trialRun') {
                interactable = canAfford;
            } else {
                 const hasBalls = balls > 0 || (type === 'giant' && giantBalls > 0);
                 interactable = hasBalls && canAfford;
            }
            
            btn.disabled = !interactable;
            
            if (!interactable && (balls > 0 || state.gameMode === 'trialRun')) btn.style.filter = "grayscale(100%) opacity(0.5)"; // Charge issue
            else if (!interactable) btn.style.filter = "grayscale(80%)"; // No balls
            else btn.style.filter = "";

            // Badge
            const badge = btn.querySelector('.ball-count-badge');
            if (badge) {
                if (state.gameMode === 'trialRun') {
                     badge.textContent = state.trialRunBallStock[type] || 0;
                     badge.classList.remove('hidden');
                } else if (type === 'giant') {
                     badge.textContent = giantBalls;
                     badge.classList.remove('hidden');
                } else {
                     badge.classList.add('hidden');
                }
            }

        } else {
            btn.classList.add('hidden');
        }
        
        // Visual Selection Sync
        if (type === state.selectedBallType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Reorder Elements (Only if signature changes to avoid DOM thrashing)
    const currentSignature = orderedTypes.join(',');
    if (currentSignature !== lastOrderedSignature) {
        lastOrderedSignature = currentSignature;
        orderedTypes.forEach(type => {
             const btn = document.querySelector(`.ball-select-btn[data-ball-type="${type}"]`);
             if (btn) {
                 dom.ballSelector.appendChild(btn); 
             }
        });
    }

    // 3. Fallback selection if current selected is hidden/invalid
    const selectedBtn = document.querySelector(`.ball-select-btn[data-ball-type="${state.selectedBallType}"]`);
    if (showSelector && (!selectedBtn || selectedBtn.classList.contains('hidden'))) {
         const firstVisible = document.querySelector('.ball-select-btn:not(.hidden)');
         if (firstVisible) {
             // We can't click() because it might re-trigger sound/logic excessively if stuck.
             // Instead, manually update state if different.
             const newType = firstVisible.dataset.ballType;
             if (state.selectedBallType !== newType) {
                 state.selectedBallType = newType;
                 // Don't call gameController change here to avoid loop, let input handle it or user click. 
                 // Actually, we must update game state to match visual fallback.
                 if(state.p5Instance) state.p5Instance.changeBallType(newType);
             }
         }
    }
    
    updateBallSelectorArrow();
}
