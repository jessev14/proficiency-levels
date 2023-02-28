import { ProficiencyAdvancement } from './ProficiencyAdvancement.js';

export const moduleID = 'proficiency-levels';


const proficiencyBonusMap = {
    1: 2,
    0.5: 1,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 14
};

const proficiencyColorMap = {
    0: '#6c6c6c',
    1: '#0040ec',
    0.5: '#00a300',
    2: '#513503',
    3: '#e3e5e4',
    4: '#d4af37',
    5: '#ffa500',
    6: '#940094',
    7: '#c20000',
};

const newProficiencyLevels = {
    3: 'Master',
    4: 'Grandmaster',
    5: 'Legend',
    6: 'Demigod',
    7: 'God'
};

const lg = x => console.log(x);


Hooks.once('init', () => {
    CONFIG.DND5E.proficiencyLevels = {
        ...CONFIG.DND5E.proficiencyLevels,
        ...newProficiencyLevels
    };

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype.rollSkill', newRollSkill, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.applications.actor.ActorSheet5e.prototype._onCycleSkillProficiency', newCycleSkillProficiency, 'OVERRIDE');

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype.rollAbilitySave', newRollAbilitySave, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.applications.actor.ActorSheet5e.prototype._onToggleAbilityProficiency', newToggleAbilityProficiency, 'OVERRIDE');

    libWrapper.register(moduleID, 'CONFIG.Item.documentClass.prototype.getAttackToHit', newGetAttackToHit, 'WRAPPER');

    libWrapper.register(moduleID, 'CONFIG.Item.documentClass.prototype.rollToolCheck', newRollToolCheck, 'WRAPPER');

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareSpellcasting', new__prepareSpellcasting, 'WRAPPER');

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareArmorClass', new_prepareArmorClass, 'WRAPPER');

    CONFIG.DND5E.advancementTypes['Proficiency'] = ProficiencyAdvancement;
});


Hooks.on('preUpdateActor', (actor, diff, options, userID) => {
    const updateData = {};

    for (const [id, skl] of Object.entries(diff.system?.skills || {})) {
        if ('value' in skl) updateData[`flags.${moduleID}.system.skills.${id}.value`] = skl.value;
    }

    for (const [id, abl] of Object.entries(diff.system?.abilities || {})) {
        if ('proficient' in abl) updateData[`flags.${moduleID}.system.abilities.${id}.proficient`] = abl.proficient;
    }

    if (Object.keys(updateData).length) return actor.update(updateData);
});

Hooks.on('renderActorAbilityConfig', (app, [html], appData) => {
    const abilityID = appData.abilityId;
    const proficiencyLevel = appData.ability.proficient;

    const proficiencySelect = html.querySelector(`select[name="system.abilities.${abilityID}.proficient"]`);

    // const halfOption = document.createElement('option');
    // halfOption.value = '0.5';
    // halfOption.text = 'Half Proficient';
    // proficiencySelect.appendChild(halfOption);

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

Hooks.on('renderActorSheet5e', async (app, [html], appData) => {
    const actor = app.object;
    const skillsUl = html.querySelector('ul.skills-list');
    for (const skillLi of skillsUl.querySelectorAll('li.skill')) {
        const skillID = skillLi.dataset.skill;
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

        const skillPassiveModspan = skillLi.querySelector('span.skill-passive');
        const passiveMod = skillMod + 10;
        skillPassiveModspan.innerText = `(${passiveMod})`;
    }

    const abilitiesUl = html.querySelector('ul.ability-scores');
    for (const abilityLi of abilitiesUl.querySelectorAll('li.ability')) {
        const abilityID = abilityLi.dataset.ability;
        const proficiencyLevel = actor.flags[moduleID]?.system.abilities?.[abilityID]?.proficient || actor.system.abilities[abilityID].proficient;

        const field = abilityLi.querySelector('input[type="hidden"]');
        field.value = proficiencyLevel;

        const proficiencyA = abilityLi.querySelector('a.proficiency-toggle.ability-proficiency');
        proficiencyA.innerHTML = proficiencyLevel;
        proficiencyA.title = CONFIG.DND5E.proficiencyLevels[proficiencyLevel];
        proficiencyA.style['font-size'] = '15px';
        proficiencyA.style['font-weight'] = '900';
        proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];

        const saveModSpan = abilityLi.querySelector('span.ability-save');
        const saveMod = getBonus(actor, proficiencyLevel) + (ability.mod || 0);
        saveModSpan.innerText = `${saveMod > 0 ? '+' : ''}${saveMod}`;
    }

    for (const itemType of ['weapon', 'armor']) {
        const label = html.querySelector(`label[for="traits.traits.${itemType}Prof"]`) || html.querySelector(`a[data-type="${itemType}"]`);
        if (!label) continue;

        const ul = label.nextElementSibling;
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

    const spellcastingAttributeDiv = html.querySelector('div.spellcasting-attribute');
    if (spellcastingAttributeDiv) spellcastingAttributeDiv.after(spellcastingProficiencyDiv);

    const spellAttackModSpan = html.querySelector('span.spell-attack-mod');
    if (spellAttackModSpan) {
        const spellcastingProficiencyLevel = actor.getFlag(moduleID, 'spellcasting');
        spellAttackModSpan.innerText = `+ ${getBonus(actor, spellcastingProficiencyLevel)}`
        spellAttackModSpan.title = '';
    }
});

Hooks.on('renderTraitSelector', (app, [html], appData) => {
    const isWeapon = app.trait === 'weapon';
    const isArmor = app.trait === 'armor';
    if (!isWeapon && !isArmor) return;

    const selector = isWeapon ? 'weapon' : 'armor';

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

async function newRollSkill(wrapped, skillID, options = {}) {
    const actor = this;
    const flagData = actor.getFlag(moduleID, `system.skills.${skillID}`);
    if (flagData) {
        const proficiencyLevel = flagData.value;
        Object.defineProperty(actor.system.skills[skillID].prof, 'term', {
            get: function () { return getBonus(actor, proficiencyLevel) },
            configurable: true
        });
    }

    return wrapped(skillID, options);
}

async function newRollAbilitySave(wrapped, abilityID, options = {}) {
    const actor = this;
    const flagData = actor.getFlag(moduleID, `system.abilities.${abilityID}`);
    if (flagData) {
        const proficiencyLevel = flagData.proficient;
        Object.defineProperty(actor.system.abilities[abilityID].saveProf, 'term', {
            get: function () { return getBonus(actor, proficiencyLevel) },
            configurable: true
        });
    }

    return wrapped(abilityID, options);
}

function newCycleSkillProficiency(event) {
    event.preventDefault();
    const field = event.currentTarget.previousElementSibling;
    const skillName = field.parentElement.dataset.skill;
    const source = this.actor.flags[moduleID]?.system?.skills?.[skillName] ?? this.actor._source.system.skills[skillName];
    if (!source) return;

    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    let idx = levels.indexOf(source.value);
    const next = idx + (event.type === "click" ? 1 : 8);
    field.value = levels[next % 9];

    return this._onSubmit(event);
}

function newToggleAbilityProficiency(event) {
    event.preventDefault();
    const field = event.currentTarget.previousElementSibling;
    const abilityName = field.closest('li').dataset.ability;
    const source = this.actor.flags[moduleID]?.system?.abilities?.[abilityName] ?? this.actor._source.system.abilities[abilityName];
    if (!source) return;

    const levels = [0, 0.5, 1, 2, 3, 4, 5, 6, 7];
    let idx = levels.indexOf(source.proficient);
    const next = idx + (!event.shiftKey ? 1 : 8);
    field.value = levels[next % 9];

    return this._onSubmit(event);
}

function newGetAttackToHit(wrapped) {
    const res = wrapped();
    if (!res) return res;

    const { rollData } = res;
    if (!rollData) return res;

    const isWeapon = this.type === 'weapon';
    const isSpell = this.type === 'spell';

    let proficiencyBonus;
    if (isWeapon) {
        const weaponProficiencies = this.actor.getFlag(moduleID, 'weapon');
        if (!weaponProficiencies) return res;

        const { baseItem, weaponType } = this.system;
        const proficiencyLevel = Math.max(weaponProficiencies[baseItem] || 0, weaponProficiencies[CONFIG.DND5E.weaponProficienciesMap[weaponType]] || 0);
        proficiencyBonus = getBonus(this.actor, proficiencyLevel);
    } else if (isSpell) {
        const spellcastingProficiencyLevel = this.actor.getFlag(moduleID, 'spellcasting');
        proficiencyBonus = getBonus(this.actor, spellcastingProficiencyLevel);
    }

    if (proficiencyBonus) rollData.prof = proficiencyBonus;
    return res;
}

function new__prepareSpellcasting(wrapped) {
    wrapped();

    const spellcastingProficiencyLevel = this.getFlag(moduleID, 'spellcasting') || 0;
    const proficiencyBonus = getBonus(this, spellcastingProficiencyLevel);
    this.system.attributes.spelldc = 8 + proficiencyBonus;
}

function new_prepareArmorClass(wrapped) {
    wrapped();

    const armorProficiencies = this.getFlag(moduleID, 'armor');
    if (!armorProficiencies) return;

    let proficiencyLevel;
    const { armor } = this;
    if (armor) {
        const { baseItem } = armor?.system || {};
        const armorType = armor?.system.armor.type;
        proficiencyLevel = Math.max(armorProficiencies[baseItem] || 0, armorProficiencies[CONFIG.DND5E.armorProficienciesMap[armorType]] || 0);
    } else {
        proficiencyLevel = this.getFlag(moduleID, 'armor.unarmored');
    }
    const proficiencyBonus = getBonus(this, proficiencyLevel);
    if (proficiencyBonus) this.system.attributes.ac.value += proficiencyBonus;

}

async function newRollToolCheck(wrapped, options = {}) {
    const item = this;
    const proficiencyLevel = item.system.proficient;
    const { actor } = item;
    Object.defineProperty(item.system.prof, 'term', {
        get: function () { return getBonus(actor, proficiencyLevel) },
        configurable: true
    });

    return wrapped(options);
}


function getBonus(actor, proficiencyLevel) {
    const level = (actor.system.details.level || Math.max(1, actor.system.details.cr));

    if (!proficiencyLevel) return 0;
    if (proficiencyLevel === 0.5) return Math.floor(level / 2) + 1;
    return level + proficiencyBonusMap[proficiencyLevel];
}
