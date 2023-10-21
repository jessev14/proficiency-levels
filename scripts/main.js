import { proficiencyBonusMap, proficiencyColorMap, newProficiencyLevels } from './CONST.js';
import { ProficiencyAdvancement } from './ProficiencyAdvancement.js';

export const moduleID = 'proficiency-levels';

const lg = x => console.log(x);


Hooks.once('init', () => {
    CONFIG.DND5E.proficiencyLevels = {
        ...CONFIG.DND5E.proficiencyLevels,
        ...newProficiencyLevels
    };

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareAbilities', newPrepareAbilities, 'WRAPPER');
    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareSkills', newPrepareSkills, 'WRAPPER');
    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareTools', newPrepareTools, 'WRAPPER');


    libWrapper.register(moduleID, 'dnd5e.applications.actor.ActorSheet5e.prototype._onToggleAbilityProficiency', newToggleAbilityProficiency, 'OVERRIDE');
    libWrapper.register(moduleID, 'dnd5e.applications.actor.ActorSheet5e.prototype._onCycleProficiency', newCycleProficiency, 'OVERRIDE');

    libWrapper.register(moduleID, 'game.dnd5e.applications.actor.ActorAbilityConfig.prototype._updateObject', ActorAbilityConfig_updateObject, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.applications.actor.ProficiencyConfig.prototype._updateObject', newUpdateProfConfig, 'WRAPPER');

    CONFIG.DND5E.advancementTypes['Proficiency'] = ProficiencyAdvancement;
});


Hooks.on('renderActorSheet5e', async (app, [html], appData) => {
    const actor = app.object;
    if (!actor.system) return;

    const abilitiesUl = html.querySelector('ul.ability-scores');
    for (const abilityLi of abilitiesUl.querySelectorAll('li.ability')) {
        const abilityID = abilityLi.dataset.ability;
        const ability = actor.system?.abilities?.[abilityID];
        if (!ability) continue;

        const proficiencyLevel = actor.flags[moduleID]?.abilities?.[abilityID]?.proficient || actor.system?.abilities?.[abilityID]?.proficient;

        const field = abilityLi.querySelector('input[type="hidden"]');
        field.value = proficiencyLevel;

        const proficiencyA = abilityLi.querySelector('a.proficiency-toggle.ability-proficiency');
        proficiencyA.innerHTML = proficiencyLevel;
        proficiencyA.title = CONFIG.DND5E.proficiencyLevels[proficiencyLevel];
        proficiencyA.style['font-size'] = '15px';
        proficiencyA.style['font-weight'] = '900';
        proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];
    }

    const skillsUl = html.querySelector('ul.skills-list');
    for (const skillLi of skillsUl.querySelectorAll('li.skill')) {
        const skillID = skillLi.dataset.key;
        const skill = actor.system?.skills?.[skillID];
        if (!skill) continue;

        const proficiencyLevel = actor.flags[moduleID]?.system?.skills?.[skillID]?.value || actor.system.skills[skillID].value;

        const field = skillLi.querySelector('input');
        field.value = proficiencyLevel;

        const proficiencyA = skillLi.querySelector('a.proficiency-toggle.skill-proficiency');
        proficiencyA.innerHTML = proficiencyLevel;
        proficiencyA.title = CONFIG.DND5E.proficiencyLevels[proficiencyLevel];
        proficiencyA.style['font-size'] = '15px';
        proficiencyA.style['font-weight'] = '900';
        proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];

        const skillModSpan = skillLi.querySelector('span.skill-mod');
        const skillMod = getBonus(actor, proficiencyLevel) + (skill.mod || 0);
        skillModSpan.innerText = `${skillMod > 0 ? '+' : ''}${skillMod}`;
    }

    const toolsUl = html.querySelector('a[data-trait="tool"]')?.nextElementSibling;
    if (toolsUl) {
        for (const toolLi of toolsUl.querySelectorAll('li.tool')) {
            const toolID = toolLi.dataset.key;
            const proficiencyLevel = actor.flags[moduleID]?.tools?.[toolID].value || actor.system.tools[toolID]?.value;
    
            const field = toolLi.querySelector('input');
            field.value = proficiencyLevel;
    
            const proficiencyA = toolLi.querySelector('a.proficiency-toggle.tool-proficiency');
            proficiencyA.innerHTML = proficiencyLevel;
            proficiencyA.style['font-size'] = '15px';
            proficiencyA.style['font-weight'] = '900';
            proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];
        }
    };
    

    for (const itemType of ['weapon', 'armor']) {
        const configButton = html.querySelector(`a.trait-selector[data-trait="${itemType}"]`);
        if (!configButton) continue;

        const formGroup = configButton.closest('div.form-group');
        const ul = formGroup.querySelector('ul.traits-list');
        if (!ul) continue;

        for (const li of ul.querySelectorAll('li')) li.remove();

        const flagData = actor.getFlag(moduleID, itemType);
        if (!flagData) continue;

        const choices = await dnd5e.documents.Trait.choices(itemType)
        for (const [k, v] of Object.entries(choices)) getFlagDataChoices(k, v);

        if (itemType === 'armor') {
            const proficiencyValue = flagData.unarmored;
            if (proficiencyValue) {
                const li = document.createElement('li');
                li.classList.add('tag');
                li.title = CONFIG.DND5E.proficiencyLevels[proficiencyValue];
                li.innerText = 'Unarmored';
                li.style.color = proficiencyColorMap[proficiencyValue];
                ul.prepend(li);
            };
        }

        function getFlagDataChoices(k, v) {
            const children = Object.entries(v.children || {});
            for (const [ck, cv] of children) getFlagDataChoices(ck, cv);

            const proficiencyValue = flagData[k];
            if (proficiencyValue) {
                const li = document.createElement('li');
                li.classList.add('tag');
                li.title = CONFIG.DND5E.proficiencyLevels[proficiencyValue];
                li.innerText = v.label;
                li.style.color = proficiencyColorMap[proficiencyValue];
                ul.appendChild(li);
            };
        }
    }

    const spellcastingProficiencyDiv = document.createElement('div');
    spellcastingProficiencyDiv.classList.add('spellcasting-attribute');
    spellcastingProficiencyDiv.innerHTML = `
        <p>Spellcasting Proficiency</p>
        <select name="flags.${moduleID}.spellcasting" data-dtype="Number">
        </select>
    `;
    const spellcastingProficiencySelect = spellcastingProficiencyDiv.querySelector('select');
    for (const [k, v] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
        const option = document.createElement('option');
        option.value = k;
        if (actor.getFlag(moduleID, 'spellcasting') == k) option.selected = true;
        option.innerText = v;
        spellcastingProficiencySelect.appendChild(option);
    }

    const spellcastingAttributeDiv = html.querySelector('div.spellcasting-ability');
    if (spellcastingAttributeDiv) spellcastingAttributeDiv.after(spellcastingProficiencyDiv);

    const spellAttackModSpan = html.querySelector('span.spell-attack-mod');
    const spellcastingAbility = actor.system.abilities[actor.system.attributes.spellcasting];
    const spellcastingAbilityMod = spellcastingAbility.mod;
    if (spellAttackModSpan) {
        const spellcastingProficiencyLevel = actor.getFlag(moduleID, 'spellcasting');
        spellAttackModSpan.innerText = `+ ${getBonus(actor, spellcastingProficiencyLevel) + spellcastingAbilityMod}`
        spellAttackModSpan.title = '';
    }
});

Hooks.on('renderActorAbilityConfig', (app, [html], appData) => {
    const abilityID = appData.abilityId;
    const proficiencyLevel = app.object.system.abilities[abilityID].proficient;

    const proficiencySelect = html.querySelector(`select[name="system.abilities.${abilityID}.proficient"]`);

    const expertiseOption = document.createElement('option');
    expertiseOption.value = '2';
    expertiseOption.text = 'Expertise';
    proficiencySelect.appendChild(expertiseOption);

    for (const [value, prof] of Object.entries(newProficiencyLevels)) {
        const option = document.createElement('option');
        option.value = value;
        option.text = prof;
        proficiencySelect.appendChild(option);
    }
    proficiencySelect.value = proficiencyLevel;
});


function newPrepareAbilities(wrapped, ...args) {
    wrapped(...args);
    const [bonusData, globalBonuses, checkBonus, originalSaves] = [...args];

    for (const [abl, ability] of Object.entries(this.system.abilities)) {
        if (this.overrides.system?.abilities?.[abl]) {
            const effects = this.effects.filter(e => e.changes.some(c => c.key === `system.abilities.${abl}.proficient`));
            for (const effect of effects) {
                for (const change of effect.changes) {
                    change.key = `flags.${moduleID}.abilities.${abl}.proficient`;
                    effect.apply(this, change);
                }
            }
        }
        const flagData = this.flags[moduleID]?.abilities?.[abl];
        if (flagData) ability.proficient = Math.min(7, flagData.proficient);

        ability.saveProf = new game.dnd5e.documents.Proficiency(getBonus(this, ability.proficient), 1);

        ability.save = ability.mod + ability.saveBonus;
        if (Number.isNumeric(ability.saveProf.term)) ability.save += ability.saveProf.flat;

        // Polymorph.
        if (originalSaves && ability.proficient) abl.save = Math.max(ability.save, originalSaves[id].save);
    }
}

function newPrepareSkills(wrapped, ...args) {
    wrapped(...args);
    const [bonusData, globalBonuses, checkBonus, originalSkills] = [...args];

    const feats = CONFIG.DND5E.characterFlags;
    const flags = this.flags.dnd5e ?? {};
    const skillBonus = simplifyBonus(globalBonuses.skill, bonusData);

    for (const [skl, skill] of Object.entries(this.system.skills)) {
        const ability = this.system.abilities[skill.ability];
        const baseBonus = simplifyBonus(skill.bonuses?.check, bonusData);

        // If AEs are changing skill proficiency, apply the AEs to the flag data before retrieving value to be set as skill proficiency level.
        if (this.overrides.system?.skills?.[skl]) {
            const effects = this.effects.filter(e => e.changes.some(c => c.key === `system.skills.${skl}.value`));
            for (const effect of effects) {
                for (const change of effect.changes) {
                    change.key = `flags.${moduleID}.skills.${skl}.value`;
                    effect.apply(this, change);
                }
            }
        }
        const flagData = this.flags[moduleID]?.skills?.[skl];
        if (flagData) skill.value = Math.min(7, flagData.value); // Note that afterwards, flag data will be inaccurate. AEs seem to apply twice.

        const checkBonusAbl = simplifyBonus(ability?.bonuses?.check, bonusData);
        skill.bonus = baseBonus + checkBonus + checkBonusAbl + skillBonus;
        skill.mod = ability?.mod ?? 0;
        skill.prof = new game.dnd5e.documents.Proficiency(getBonus(this, skill.value), 1);
        skill.proficient = skill.value;
        skill.total = skill.mod + skill.bonus;
        if (Number.isNumeric(skill.prof.term)) skill.total += skill.prof.flat;

        // Polymorph.
        if (originalSkills) skill.value = Math.max(skill.value, originalSkills[id].value);

        // Passive bonus.
        const passive = flags.observantFeat && (feats.observantFeat.skills.includes(id)) ? 5 : 0;
        const passiveBonus = simplifyBonus(skill.bonuses?.passive, bonusData);
        skill.passive = 10 + skill.mod + skill.bonus + skill.prof.flat + passive + passiveBonus;
    }

}

function newPrepareTools(wrapped, ...args) {
    wrapped(...args);
    const [bonusData, globalBonuses, checkBonus] = [...args];

    for (const [tol, tool] of Object.entries(this.system.tools)) {
        const ability = this.system.abilities[tool.ability];
        const baseBonus = simplifyBonus(tool.bonuses.check, bonusData);

        // If AEs are changing tool proficiency, apply the AEs to the flag data before retrieving value to be set as tool proficiency level.
        if (this.overrides.system?.tools?.[tol]) {
            const effects = this.effects.filter(e => e.changes.some(c => c.key === `system.tools.${tol}.value`));
            for (const effect of effects) {
                for (const change of effect.changes) {
                    change.key = `flags.${moduleID}.tools.${tol}.value`;
                    effect.apply(this, change);
                }
            }
        }
        const flagData = this.flags[moduleID]?.tools?.[tol];
        if (flagData) tool.value = Math.min(7, flagData.value);

        const checkBonusAbl = simplifyBonus(ability?.bonuses?.check, bonusData);
        tool.bonus = baseBonus + checkBonus + checkBonusAbl;
        tool.mod = ability?.mod ?? 0;
        tool.prof = new game.dnd5e.documents.Proficiency(getBonus(this, tool.value), 1);
        tool.total = tool.mod + tool.bonus;
        if (Number.isNumeric(tool.prof.term)) tool.total += tool.prof.flat;
    }

}



function newToggleAbilityProficiency(event) {
    if (event.currentTarget.classList.contains("disabled")) return;

    event.preventDefault();

    const field = event.currentTarget.previousElementSibling;
    const abl = field.name.split('.')[2];
    const proficient = getProperty(this.actor, field.name);
    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    let idx = levels.indexOf(proficient);
    const next = idx + (!event.shiftKey ? 1 : levels.length - 1);
    const newProficient = levels[next % (levels.length)];

    return this.actor.setFlag(moduleID, `abilities.${abl}.proficient`, newProficient);
}

async function newCycleProficiency(event) {
    if (event.currentTarget.classList.contains("disabled")) return;

    event.preventDefault();

    const parent = event.currentTarget.closest(".proficiency-row");
    const field = parent.querySelector('[name$=".value"]');
    const { property, key } = parent.dataset;
    const isSkill = property === 'skills';
    const value = getProperty(this.actor, `flags.${moduleID}.${isSkill ? 'skills' : 'tools'}.${key}.value`) ?? this.actor._source.system[property]?.[key]?.value ?? 0;

    // Cycle to the next or previous skill level.
    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    const idx = levels.indexOf(value);
    const next = idx + (event.type === "contextmenu" ? (levels.length - 1) : 1);
    field.value = levels[next % levels.length];

    // Update the field value and save the form.
    await this.actor.update({ [`flags.${moduleID}.${isSkill ? 'skills' : 'tools'}.${key}.value`]: Number(field.value) });
    return this._onSubmit(event);
}



async function ActorAbilityConfig_updateObject(wrapped, event, formData) {
    const abl = this._abilityId;
    const proficiencyLevel = formData['system.abilities.str.proficient'];
    await this.object.setFlag(moduleID, `abilities.${abl}.proficient`, proficiencyLevel);

    return wrapped(event, formData);
}

async function newUpdateProfConfig(wrapped, event, formData) {
    const skillsTools = this.isSkill ? 'skills' : 'tools';
    const skillToolID = this.id.split('-').pop();
    const value = formData[`system.${skillsTools}.${skillToolID}.value`];
    await this.object.setFlag(moduleID, `${skillsTools}.${skillToolID}.value`, value);

    return wrapped(event, formData);
}



function getBonus(actor, proficiencyLevel) {
    const level = (actor.system.details.level || Math.max(1, actor.system.details.cr));

    if (!proficiencyLevel) return 0;
    if (proficiencyLevel === 0.5) return Math.floor(level / 2) + 1;
    return level + proficiencyBonusMap[proficiencyLevel];
}

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
