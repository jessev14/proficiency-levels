import { moduleID } from './main.js';

const lg = x => console.log(x);

export class ProficiencyAdvancement extends dnd5e.documents.advancement.ScaleValueAdvancement {

    static get metadata() {
        return foundry.utils.mergeObject(super.metadata, {
            dataModels: {},
            order: 70,
            title: 'Proficiency Level',
            hint: 'Upgrade a selected proficiency level when the character reaches a certain level.',
            apps: {
                config: ProficiencyAdvancementConfig
            }
        });
    }

    async apply(level, data) {
        const { actor } = this;

        const [proficiencyType, proficiency] = this.configuration.identifier.split('-');
        if (!proficiency) return;

        const newProficiencyLevel = parseFloat(this.configuration.scale[level].value);
        let oldProficiencyLevel;
        switch (proficiencyType) {
            case 'abilities':
                oldProficiencyLevel = actor.system.abilities[proficiency].proficient;
                if (oldProficiencyLevel >= newProficiencyLevel) return;

                return actor.updateSource({ [`system.abilities.${proficiency}.proficient`]: newProficiencyLevel });
            case 'skills':
                oldProficiencyLevel = actor.flags[moduleID].system.skills[proficiency]?.value;
                if (oldProficiencyLevel >= newProficiencyLevel) return;

                return actor.updateSource({ [`system.skills.${proficiency}.value`]: newProficiencyLevel });
            case 'weapon':
            case 'armor':
                oldProficiencyLevel = actor.flags[moduleID][proficiencyType][proficiency];
                if (oldProficiencyLevel >= newProficiencyLevel) return;

                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}.${proficiency}`]: newProficiencyLevel });
            case 'spellcasting':
                oldProficiencyLevel = actor.flags[moduleID].spellcasting;
                if (oldProficiencyLevel >= newProficiencyLevel) return;

                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}`]: newProficiencyLevel });
        }
    }

}



class ProficiencyAdvancementConfig extends dnd5e.applications.advancement.ScaleValueConfig {

    async activateListeners($html) {
        super.activateListeners($html);
        const [html] = $html;

        const selectedProficiency = this.advancement.configuration.identifier;

        html.querySelector('p.hint.type-hint').closest('div.form-group').remove();
        html.querySelector('p.hint.identifier-hint').remove();

        const identifierSelect = document.createElement('select');
        identifierSelect.name = 'configuration.identifier';

        identifierSelect.innerHTML = `<select name="value.proficiency">`;

        identifierSelect.innerHTML += `<optgroup label="Saving Throws">`;
        for (const [abilityKey, abilityLabel] of Object.entries(CONFIG.DND5E.abilities)) {
            identifierSelect.innerHTML += `<option value="abilities-${abilityKey}">${abilityLabel}</option>`;
        }
        identifierSelect.innerHTML += `</optgroup>`;

        identifierSelect.innerHTML += `<optgroup label="Skills">`;
        for (const [skillKey, skill] of Object.entries(CONFIG.DND5E.skills)) {
            identifierSelect.innerHTML += `<option value="skills-${skillKey}">${skill.label}</option>`;
        }
        identifierSelect.innerHTML += `</optgroup>`;

        identifierSelect.innerHTML += `<optgroup label="Weapons">`;
        const weaponTraits = await dnd5e.documents.Trait.choices('weapon');
        processTraits(weaponTraits, 'weapon');
        identifierSelect.innerHTML += `</optgroup>`;

        identifierSelect.innerHTML += `<optgroup label="Armor">`;
        identifierSelect.innerHTML += `<option value="armor-unarmored">Unarmored</option>`;
        const armorTraits = await dnd5e.documents.Trait.choices('armor');
        processTraits(armorTraits, 'armor');
        identifierSelect.innerHTML += `</optgroup>`;

        function processTraits(traitsObj, type) {
            for (const [key, trait] of Object.entries(traitsObj)) {
                identifierSelect.innerHTML += `<option value="${type}-${key}">${trait.label}</option>`;

                const children = trait.children || {};
                processTraits(children, type);
            }
        }

        identifierSelect.innerHTML += `<optgroup label="Spellcasting"><option value="spellcasting-spellcasting">Spellcasting</option></optgroup></select>`;

        identifierSelect.value = selectedProficiency;
        const identifierInput = html.querySelector('input[name="configuration.identifier"]');
        identifierInput.after(identifierSelect);
        identifierInput.closest('div.form-group').querySelector('label').innerText = 'Proficiency';
        identifierInput.remove();

        for (const input of html.querySelector('div.right-column').querySelectorAll('input[type="text"]')) {
            const characterLevel = parseInt(input.dataset.level);
            const levelSelect = document.createElement('select');
            levelSelect.name = `configuration.scale.${characterLevel}.value`;
            levelSelect.add(new Option('--', ''));
            for (const [k, v] of Object.entries(CONFIG.DND5E.proficiencyLevels)) {
                const option = new Option(v, k);
                levelSelect.add(option);
            }
            if (this.advancement.configuration.scale[characterLevel]?.value) levelSelect.value = this.advancement.configuration.scale[characterLevel].value;
            input.after(levelSelect);
            input.remove();
        }
    }

    _onChangeTitle(event) { }
}
