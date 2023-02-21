const moduleID = 'proficiency-levels';

const proficiencyBonusMap = {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 14
};

const proficiencyColorMap = {
    0: '#585858',
    1: '#4e546a',
    0.5: '#465079',
    2: '#3c4b8d',
    3: '#2942b2',
    4: '#213fc0',
    5: '#1f3ec4',
    6: '#0e36e4',
    7: '#0030ff',
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
});


Hooks.on('preUpdateActor', (actor, diff, options, userID) => {
    lg({ diff })
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
    const option = document.createElement('option');
    option.value = '2';
    option.text = 'Expertise';
    proficiencySelect.appendChild(option);
    for (const [value, prof] of Object.entries(newProficiencyLevels)) {
        const option = document.createElement('option');
        option.value = value;
        option.text = prof;
        proficiencySelect.appendChild(option);
    }
    proficiencySelect.value = proficiencyLevel;
});

Hooks.on('renderActorSheet5e', (app, [html], appData) => {
    const actor = app.object;
    const skillsUl = html.querySelector('ul.skills-list');
    for (const skillLi of skillsUl.querySelectorAll('li.skill')) {
        const skillID = skillLi.dataset.skill;
        const proficiencyLevel = actor.flags[moduleID]?.system.skills?.[skillID]?.value || actor.system.skills[skillID].value;

        const field = skillLi.querySelector('input');
        field.value = proficiencyLevel;

        const proficiencyA = skillLi.querySelector('a.proficiency-toggle.skill-proficiency');
        proficiencyA.innerHTML = proficiencyLevel;
        proficiencyA.style['font-size'] = '15px';
        proficiencyA.style['font-weight'] = '900';
        proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];

        const skillModSpan = skillLi.querySelector('span.skill-mod');
        const skillMod = getBonus(actor, proficiencyLevel);
        skillModSpan.innerText = `+${skillMod}`;
    }

    const abilitiesUl = html.querySelector('ul.ability-scores');
    for (const abilityLi of abilitiesUl.querySelectorAll('li.ability')) {
        const abilityID = abilityLi.dataset.ability;
        const proficiencyLevel = actor.flags[moduleID]?.system.abilities?.[abilityID]?.proficient || actor.system.abilities[abilityID].proficient;

        const field = abilityLi.querySelector('input[type="hidden"]');
        field.value = proficiencyLevel;

        const proficiencyA = abilityLi.querySelector('a.proficiency-toggle.ability-proficiency');
        proficiencyA.innerHTML = proficiencyLevel;
        proficiencyA.style['font-size'] = '15px';
        proficiencyA.style['font-weight'] = '900';
        proficiencyA.style.color = proficiencyColorMap[proficiencyLevel];

        const saveModSpan = abilityLi.querySelector('span.ability-save');
        const saveMod = getBonus(actor, proficiencyLevel);
        saveModSpan.innerText = `+${saveMod}`;
    }
});

Hooks.on('renderItemSheet5e', (app, [html], appData) => {
    const item = app.object;
    const proficiencyLevelFlag = item.getFlag(moduleID, 'proficiencyLevel') || 0;
    let injectLocation;
    
    if (item.type === 'weapon') {
        const profCheck = html.querySelector('input[type="checkbox"][name="system.proficient"]');
        const profLabel = profCheck.parentElement;
        injectLocation = profLabel.parentElement.parentElement;
        profCheck.parentElement.remove();
    } else if (item.type === 'spell') injectLocation = html.querySelector('div.spell-components.form-group.stacked');
    else if (item.type === 'feat') injectLocation = html.querySelector('div.form-group.input-select');
    else return;

    const proficiencyDiv = document.createElement('div');
    proficiencyDiv.classList.add('form-group');
    let options = ``;
    for (const [value, prof] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
        if (value === "0.5") continue;

        options += `<option value="${value}" ${proficiencyLevelFlag === parseInt(value) ? 'selected' : ''}>${prof}</option>`
    }
    proficiencyDiv.innerHTML =`
        <label>Proficiency Level</label>
        <select name="flags.${moduleID}.proficiencyLevel" data-dtype="Number">
            ${options}
        </select>
    `;
    injectLocation.before(proficiencyDiv);
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
    
    const proficiencyLevelFlag = this.getFlag(moduleID, 'proficiencyLevel');
    if (!proficiencyLevelFlag) return res;

    const actorLevel = this.actor?.system.details.level || 0;
    rollData.prof = proficiencyLevelFlag * 2 + actorLevel;

    return res;
}


function getBonus(actor, proficiencyLevel) {
    return [0, 0.5].includes(proficiencyLevel)
        ? 0
        : (actor.system.details.level || Math.max(1, actor.system.details.cr)) + proficiencyBonusMap[proficiencyLevel];
}
