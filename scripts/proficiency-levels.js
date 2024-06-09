import { proficiencyBonusMap, proficiencyColorMap, newProficiencyLevels, armorMap } from './CONST.js';

export const moduleID = 'proficiency-levels';

export const lg = x => console.log(x);


Hooks.once('init', () => {
    CONFIG.DND5E.proficiencyLevels = {
        ...CONFIG.DND5E.proficiencyLevels,
        ...newProficiencyLevels
    };

    libWrapper.register(moduleID, 'dnd5e.dataModels.actor.CommonTemplate.defineSchema', newCommonSchema, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.dataModels.actor.CommonTemplate.prototype.prepareAbilities', newPrepareAbilities, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.dataModels.actor.CreatureTemplate.defineSchema', newCreatureSchema, 'WRAPPER');

    libWrapper.register(moduleID, 'dnd5e.documents.Actor5e.prototype._prepareSkill', new_prepareSkill, 'WRAPPER');

    libWrapper.register(moduleID, 'dnd5e.applications.actor.ActorAbilityConfig.prototype.getData', newAbilityGetData, 'WRAPPER');

    libWrapper.register(moduleID, 'dnd5e.documents.Actor5e.prototype._prepareSpellcasting', new_prepareSpellcasting, 'WRAPPER');

    libWrapper.register(moduleID, 'dnd5e.documents.Actor5e.prototype._prepareArmorClass', new_prepareArmorClass, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.documents.Actor5e.prototype._prepareArmorClassAttribution', new_prepareArmorClassAttribution, 'WRAPPER');
});


Hooks.on('renderActorSheet', (app, [html], appData) => {
    const { actor } = app;

    if (app.options.classes.includes('dnd5e2')) {
        const savesUl = html.querySelector('filigree-box.saves').querySelector('ul');
        for (const saveLi of savesUl.querySelectorAll('li')) {
            const abl = saveLi.dataset.ability;
            if (abl === 'concentration') continue;

            const proficiencyLevel = actor.system.abilities[abl].proficient;
            const toggleButton = saveLi.querySelector('proficiency-cycle');
            toggleButton.shadowRoot.innerHTML = `${proficiencyLevel}`;
        }

        const skillsUl = html.querySelector('filigree-box.skills').querySelector('ul');
        for (const skillLi of skillsUl.querySelectorAll('li')) {
            const skl = skillLi.dataset.key
            const proficiencyLevel = actor.system.skills[skl].value;
            const toggleButton = skillLi.querySelector('proficiency-cycle');
            toggleButton.shadowRoot.innerHTML = `${proficiencyLevel}`;
        }

        const toolsUl = html.querySelector('filigree-box.tools').querySelector('ul');
        for (const toolLi of toolsUl.querySelectorAll('li')) {
            const toolKey = toolLi.dataset.key
            const proficiencyLevel = actor.system.tools[toolKey].value;
            const toggleButton = toolLi.querySelector('proficiency-cycle');
            toggleButton.shadowRoot.innerHTML = `${proficiencyLevel}`;

            const rollBonusDiv = toolLi.querySelector('div.bonus');
            const rollBonus = getBonus(actor, proficiencyLevel) + actor.system.tools[toolKey].mod;
            const sign = rollBonus > 0 ? '+' : '-';
            rollBonusDiv.innerHTML = `<span class="sign">${sign}</span>${rollBonus}`;
        }

        const spellcastingProficiencyDiv = document.createElement('div');
        spellcastingProficiencyDiv.innerHTML = `<span>Spellcasting Proficiency <select data-dtype="Number"></select></span>`;
        const spellcastingProficiencySelect = spellcastingProficiencyDiv.querySelector('select');
        for (const [k, v] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
            const option = document.createElement('option');
            option.value = k;
            option.innerText = v;
            spellcastingProficiencySelect.appendChild(option);
        }
        spellcastingProficiencySelect.value = actor.getFlag(moduleID, 'spellcasting');
        spellcastingProficiencySelect.addEventListener('change', event => {
            const proficiencyLevel = event.target.value;
            return actor.setFlag(moduleID, 'spellcasting', proficiencyLevel);
        });
        const spellsList = html.querySelector('div.tab.spells').querySelector('dnd5e-inventory.inventory-element');
        spellsList.before(spellcastingProficiencyDiv);

    } else if (app.options.classes.includes('tidy5e-sheet')) {
        const spellcastingFooter = html.querySelector('footer.spellbook-footer');
        const spellcastingAttribute = spellcastingFooter.querySelector('div.spellcasting-attribute');
        const spellcastingLabel = spellcastingAttribute.querySelector('p');
        const spellcastingProficiencyDiv = document.createElement('div');
        spellcastingProficiencyDiv.className = spellcastingAttribute.className;
        spellcastingProficiencyDiv.innerHTML = `
            <p class="${spellcastingLabel.className}">Spellcasting Proficiency</p>
            <select data-dtype="Number">
            </select>
        `;
        const spellcastingProficiencySelect = spellcastingProficiencyDiv.querySelector('select');
        for (const [k, v] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
            const option = document.createElement('option');
            option.value = k;
            option.innerText = v;
            spellcastingProficiencySelect.appendChild(option);
        }
        spellcastingProficiencySelect.value = actor.getFlag(moduleID, 'spellcasting');
        spellcastingProficiencySelect.addEventListener('change', event => {
            const proficiencyLevel = event.target.value;
            return actor.setFlag(moduleID, 'spellcasting', proficiencyLevel);
        });
        spellcastingFooter.appendChild(spellcastingProficiencyDiv);
    };
});

Hooks.on('tidy5e-sheet.renderActorSheet', async (app, html, appData, rerender) => {
    const { actor } = app;

    const actorStats = html.querySelector('section.actor-stats');
    if (actorStats) {
        for (const abilityDiv of actorStats.querySelectorAll('div[data-tidy-sheet-part="ability-score-container"]')) {
            const abl = abilityDiv.dataset.ability;
            const toggleButton = abilityDiv.querySelector('button.proficiency-toggle');
            const proficiencyLevel = actor.system.abilities[abl].proficient;
            toggleButton.innerHTML = `${proficiencyLevel}`;
            toggleButton.style.color = proficiencyColorMap[proficiencyLevel];
            toggleButton.style['text-shadow'] = '0 0 1px black';
            toggleButton.removeEventListener('click', cycleAbilityProficiency, { capture: true });
            toggleButton.addEventListener('click', cycleAbilityProficiency, { capture: true });
            // TODO: contextmenu; kgar pre-hook ?
        }
    }

    const skillsList = html.querySelector('ul.skills-list');
    if (skillsList) {
        for (const skillLi of skillsList.querySelectorAll('li.proficiency-row.skill')) {
            const skl = skillLi.dataset.key;
            const toggleButton = skillLi.querySelector('button.skill-proficiency-toggle');
            const proficiencyLevel = actor.system.skills[skl].value;
            toggleButton.innerHTML = `${proficiencyLevel}`;
            toggleButton.style.color = proficiencyColorMap[proficiencyLevel];
            toggleButton.style['text-shadow'] = '0 0 1px black';
            toggleButton.removeEventListener('click', cycleSkillProficiency, { capture: true });
            toggleButton.addEventListener('click', cycleSkillProficiency, { capture: true });
            // TODO: contextmenu; kgar pre-hook ?
        }
    }

    for (const selector of ['Weapon', 'Armor']) {
        const itemType = selector.slugify();

        const traitDiv = html.querySelector(`span.trait-icon[aria-label="${selector} Proficiencies"]`)?.closest('div.trait-form-group');
        if (!traitDiv) continue;

        const traitsUl = traitDiv.querySelector('ul.trait-list');
        for (const li of traitsUl.querySelectorAll('li')) li.remove();
        const choices = await dnd5e.documents.Trait.choices(itemType);
        const flagData = actor.getFlag(moduleID, itemType);
        for (const [k, v] of Object.entries(choices)) getFlagDataChoices(k, v);

        if (itemType === 'armor') {
            const proficiencyLevel = flagData?.unarmored;
            if (proficiencyLevel) {
                const li = document.createElement('li');
                li.classList.add('trait-tag');
                li.title = CONFIG.DND5E.proficiencyLevels[proficiencyLevel];
                li.innerText = 'Unarmored';
                li.style.color = proficiencyColorMap[proficiencyLevel];
                li.style['text-shadow'] = '0 0 1px black';
                traitsUl.prepend(li);
            };
        }

        function getFlagDataChoices(k, v) {
            const children = Object.entries(v.children || {});
            for (const [ck, cv] of children) getFlagDataChoices(ck, cv);

            const proficiencyLevel = flagData?.[k];
            if (proficiencyLevel) {
                const li = document.createElement('li');
                li.classList.add('trait-tag');
                li.title = CONFIG.DND5E.proficiencyLevels[proficiencyLevel];
                li.innerText = v.label;
                li.style.color = proficiencyColorMap[proficiencyLevel];
                li.style['text-shadow'] = '0 0 1px black';
                traitsUl.appendChild(li);
            }
        }
    }

    const toolsUl = html.querySelector('ul.trait-list.tools');
    if (toolsUl) {
        for (const toolLi of toolsUl.querySelectorAll('li.tool')) {
            const toolID = toolLi.dataset.key;
            const proficiencyLevel = actor.system.tools[toolID].value;
            const toggleButton = toolLi.querySelector('button.tool-proficiency-toggle');
            toggleButton.innerHTML = `${proficiencyLevel}`;
            toggleButton.style.color = proficiencyColorMap[proficiencyLevel];
            toggleButton.style['text-shadow'] = '0 0 1px black';
            toggleButton.removeEventListener('click', cycleToolProficiency, { capture: true });
            toggleButton.addEventListener('click', cycleToolProficiency, { capture: true });
        };
    }

    html.querySelector('span.spell-attack-mod').innerText = `+${actor.system.attributes.spellmod}`;
});

Hooks.on('renderTraitSelector', (app, [html], appData) => {
    const isWeapon = app.trait === 'weapon';
    const isArmor = app.trait === 'armor';
    const isTool = app.trait === 'tool';
    if (!isWeapon && !isArmor) return;

    const selector = app.trait;

    for (const li of html.querySelectorAll('li')) {
        const input = li.querySelector('input');
        const inputName = input.name.split('.')[1];
        input.remove();

        const select = document.createElement('select');
        select.name = `flags.${moduleID}.${selector}.${inputName}`;
        select.dataset.dtype = 'Number';
        for (const [value, prof] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
            const option = document.createElement('option');
            option.value = value;
            option.innerText = prof;
            select.appendChild(option);
        }
        select.value = app.object.getFlag(moduleID, `${selector}.${inputName}`);
        const label = li.querySelector('label');
        label.classList.add(moduleID);
        label.appendChild(select);
    }

    if (selector === 'armor') {
        const select = html.querySelector('select').cloneNode(true);
        select.name = `flags.${moduleID}.armor.unarmored`;
        const flagData = app.object.getFlag(moduleID, 'armor.unarmored');
        for (const option of select.querySelectorAll('option')) {
            if (option.value == flagData) {
                option.selected = true;
                break;
            }
        }
        const label = document.createElement('label');
        label.classList.add('checkbox', moduleID);
        label.innerText = 'Unarmored';
        label.appendChild(select);
        const li = document.createElement('li');
        li.appendChild(label);
        html.querySelector('ol').prepend(li);
    }

    const og_prepareUpdateData = app._prepareUpdateData;
    app._prepareUpdateData = function (formData) {
        const updateData = og_prepareUpdateData.call(app, formData);
        const isCustom = `system.traits.${selector}Prof.custom` in updateData;
        if (isCustom) {
            delete formData.custom;
            formData[`system.traits.${selector}Prof.custom`] = updateData[`system.traits.${selector}Prof.custom`];
        }
        return formData;
    }
});

Hooks.on('dnd5e.preRollAttack', (item, rollConfig) => {
    const { actor } = item;
    rollConfig.parts = rollConfig.parts.filter(p => p !== '@prof');

    let proficiencyLevel;
    if (item.type === 'weapon') {
        const flagData = actor.getFlag(moduleID, 'weapon');
        proficiencyLevel = Math.max(flagData[item.system.type?.baseItem], flagData[item.system.type?.value === 'simpleM' ? 'sim' : 'mar']);
    } else proficiencyLevel = actor.getFlag(moduleID, 'spellcasting');

    if (proficiencyLevel) rollConfig.parts.push(`+${getBonus(actor, proficiencyLevel)}`);
});

Hooks.on('dnd5e.preRollToolCheck', (actor, rollData, toolID) => {
    rollData.parts = rollData.parts.filter(p => p !== '@prof');
    const proficiencyLevel = actor.system.tools[toolID].value;
    if (proficiencyLevel) rollData.parts.push(`+${getBonus(actor, proficiencyLevel)}`);
});


function newCommonSchema(wrapped) {
    const schema = wrapped();
    schema.abilities.model.fields.proficient.max = 7;

    return schema;
}

function newPrepareAbilities(wrapped, ...args) {
    wrapped(...args);

    for (const [id, abl] of Object.entries(this.abilities)) {
        abl.saveProf = new dnd5e.documents.Proficiency(getBonus({ system: this }, abl.proficient), 1);
        abl.save = abl.mod + getBonus({ system: this }, abl.proficient);

        // TODO: confirm polymorph
    }
}

function newCreatureSchema(wrapped) {
    const schema = wrapped();
    schema.skills.model.fields.value.max = 7;
    schema.tools.model.fields.value.max = 7;

    return schema;
}

function new_prepareSkill(wrapped, skillId, {
    skillData, rollData, originalSkills, globalBonuses,
    globalCheckBonus, globalSkillBonus, ability
} = {}) {
    skillData = wrapped(skillId, {
        skillData, rollData, originalSkills, globalBonuses,
        globalCheckBonus, globalSkillBonus, ability
    });

    const newBonus = getBonus(this, skillData.value);
    skillData.prof = new dnd5e.documents.Proficiency(newBonus, 1, skillData.prof.rounding === "down");
    skillData.proficient = skillData.value;
    skillData.total = skillData.mod + skillData.bonus + newBonus;

    const flags = this.flags.dnd5e ?? {};
    const feats = CONFIG.DND5E.characterFlags;
    const passive = flags.observantFeat && feats.observantFeat.skills.includes(skillId) ? 5 : 0;
    const passiveBonus = simplifyBonus(skillData.bonuses?.passive, rollData);
    skillData.passive = 10 + skillData.mod + skillData.bonus + newBonus + passive + passiveBonus;

    function simplifyBonus(bonus, data = {}) {
        if (!bonus) return 0;
        if (Number.isNumeric(bonus)) return Number(bonus);
        try {
            const roll = new Roll(bonus, data);
            return roll.isDeterministic ? Roll.safeEval(roll.formula) : 0;
        } catch (error) {
            console.error(error);
            return 0;
        }
    }

    // TODO: confirm polymorph
    return skillData;
}


function newAbilityGetData(wrapped, options) {
    const context = wrapped(options);
    context.proficiencyLevels = CONFIG.DND5E.proficiencyLevels;

    return context;
}

function cycleSkillProficiency(event) {
    event.stopPropagation();

    const actorID = event.target.closest('div.tidy5e-sheet').id.split('-').pop();
    const actor = game.actors.get(actorID);
    const skl = event.target.closest('li.proficiency-row.skill').dataset.key;
    const proficiencyLevel = actor.system.skills[skl].value;
    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    const idx = levels.indexOf(proficiencyLevel);
    const next = idx + (event.type === "contextmenu" ? 7 : 1);
    const nextLevel = levels[next % levels.length];
    return actor.update({ [`system.skills.${skl}.value`]: nextLevel });
}

function cycleAbilityProficiency(event) {
    event.stopPropagation();

    const actorID = event.target.closest('div.tidy5e-sheet').id.split('-').pop();
    const actor = game.actors.get(actorID);
    const abl = event.target.closest('div[data-tidy-sheet-part="ability-score-container"]').dataset.ability;
    const proficiencyLevel = actor.system.abilities[abl].proficient;
    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    const idx = levels.indexOf(proficiencyLevel);
    const next = idx + (event.type === "contextmenu" ? 7 : 1);
    const nextLevel = levels[next % levels.length];
    return actor.update({ [`system.abilities.${abl}.proficient`]: nextLevel });
}

function cycleToolProficiency(event) {
    event.stopPropagation();

    const actorID = event.target.closest('div.tidy5e-sheet').id.split('-').pop();
    const actor = game.actors.get(actorID);
    const toolID = event.target.closest('li.tool').dataset.key;
    const proficiencyLevel = actor.system.tools[toolID].value;
    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    const idx = levels.indexOf(proficiencyLevel);
    const next = idx + (event.type === "contextmenu" ? 7 : 1);
    const nextLevel = levels[next % levels.length];
    return actor.update({ [`system.tools.${toolID}.value`]: nextLevel });
}

function new_prepareSpellcasting(wrapped) {
    wrapped();

    const spellcastingAbility = this.system.abilities[this.system.attributes.spellcasting];
    if (!spellcastingAbility) return;

    const spellcastingAbilityMod = spellcastingAbility.mod;
    const spellcastingProficiencyLevel = this.getFlag(moduleID, 'spellcasting') || 0;
    const proficiencyBonus = getBonus(this, spellcastingProficiencyLevel);
    this.system.attributes.spelldc = 8 + spellcastingAbilityMod + proficiencyBonus;
    this.system.attributes.spellmod = this.system.attributes.spelldc - 8;
}

function new_prepareArmorClass(wrapped) {
    wrapped();
    const armor = this.system.attributes.ac.equippedArmor;
    if (!armor) return;

    const valueType = armorMap[armor.system.type.value];
    const baseType = armor.system.type.baseItem;
    const proficiencyLevel = Math.max(this.getFlag(moduleID, `armor.${valueType}`), this.getFlag(moduleID, `armor.${baseType}`));
    this.system.attributes.ac.value += getBonus(this, proficiencyLevel);
}

async function new_prepareArmorClassAttribution(wrapped, ...args) {
    let res = await wrapped(...args);

    const armor = this.system.attributes.ac.equippedArmor;
    if (armor) {
        const valueType = armorMap[armor.system.type.value];
        const baseType = armor.system.type.baseItem;
        const proficiencyLevel = Math.max(this.getFlag(moduleID, `armor.${valueType}`), this.getFlag(moduleID, `armor.${baseType}`));
        const container = document.createElement('div');
        container.innerHTML = res;
        const proficiencyRow = document.createElement('tr');
        proficiencyRow.innerHTML = `
            <td class="attribution-value mode-2"> ${getBonus(this, proficiencyLevel)}</td>
            <td class="attribution-label">Armor Proficiency Bonus</td>
        `;
        const table = container.querySelector('table');
        const totalRow = table.querySelector('tr.total');
        totalRow.before(proficiencyRow);
        res = table.outerHTML;
    }

    return res;
}

function getBonus(actor, proficiencyLevel) {
    proficiencyLevel = Math.min(proficiencyLevel, 7);
    const level = (actor.system.details.level || Math.max(1, actor.system.details.cr));

    if (!proficiencyLevel) return 0;
    if (proficiencyLevel === 0.5) return Math.floor(level / 2) + 1;
    return level + proficiencyBonusMap[proficiencyLevel];
}
