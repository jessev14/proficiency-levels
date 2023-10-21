import { ProficiencyAdvancement } from './ProficiencyAdvancement.js';


Hooks.once('init', () => {

    libWrapper.register(moduleID, 'CONFIG.Item.documentClass.prototype.getAttackToHit', newGetAttackToHit, 'WRAPPER');

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareSpellcasting', new__prepareSpellcasting, 'WRAPPER');

    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype._prepareArmorClass', new_prepareArmorClass, 'WRAPPER');

    CONFIG.DND5E.advancementTypes['Proficiency'] = ProficiencyAdvancement;
});



Hooks.on('renderActorSheet5e', async (app, [html], appData) => {
    const actor = app.object;
    if (!actor.system) return;

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

        const skillPassiveModspan = skillLi.querySelector('span.skill-passive');
        const passiveMod = skillMod + 10;
        skillPassiveModspan.innerText = `(${passiveMod})`;
    }

    const abilitiesUl = html.querySelector('ul.ability-scores');
    for (const abilityLi of abilitiesUl.querySelectorAll('li.ability')) {
        const abilityID = abilityLi.dataset.ability;
        const ability = actor.system?.abilities?.[abilityID];
        if (!ability) continue;

        const proficiencyLevel = actor.flags?.[moduleID]?.system?.abilities?.[abilityID]?.proficient || actor.system?.abilities?.[abilityID]?.proficient || 0;

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

    if (proficiencyBonus !== null) rollData.prof = proficiencyBonus;
    return res;
}

function new__prepareSpellcasting(wrapped) {
    wrapped();

    const spellcastingAbility = this.system.abilities[this.system.attributes.spellcasting];
    if (!spellcastingAbility) return;

    const spellcastingAbilityMod = spellcastingAbility.mod;
    const spellcastingProficiencyLevel = this.getFlag(moduleID, 'spellcasting') || 0;
    const proficiencyBonus = getBonus(this, spellcastingProficiencyLevel);
    this.system.attributes.spelldc = 8 + spellcastingAbilityMod + proficiencyBonus;
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
