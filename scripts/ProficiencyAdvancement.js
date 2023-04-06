import { moduleID } from './main.js';

const lg = x => console.log(x);

export class ProficiencyAdvancement extends dnd5e.documents.advancement.Advancement {

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

        const levelsToIncrease = parseInt(this.configuration.levels);
        let oldProficiencyLevel, newProficiencyLevel;
        switch (proficiencyType) {
            case 'abilities':
                oldProficiencyLevel = actor.system.abilities[proficiency].proficient || 0;
                await this.updateSource({ 'configuration.oldProf': oldProficiencyLevel });
                newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                return actor.updateSource({ [`system.abilities.${proficiency}.proficient`]: newProficiencyLevel });
            case 'skills':
                oldProficiencyLevel = actor.flags[moduleID]?.system?.skills[proficiency]?.value || 0;
                await this.updateSource({ 'configuration.oldProf': oldProficiencyLevel });
                newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                return actor.updateSource({ [`system.skills.${proficiency}.value`]: newProficiencyLevel });
            case 'weapon':
            case 'armor':
                oldProficiencyLevel = actor.flags[moduleID]?.[proficiencyType][proficiency] || 0;
                await this.updateSource({ 'configuration.oldProf': oldProficiencyLevel });
                newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}.${proficiency}`]: newProficiencyLevel });
            case 'spellcasting':
                oldProficiencyLevel = actor.flags[moduleID]?.spellcasting || 0;
                await this.updateSource({ 'configuration.oldProf': oldProficiencyLevel });
                newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}`]: newProficiencyLevel });
        }
    }

    async reverse(level) {
        const { actor } = this;

        const [proficiencyType, proficiency] = this.configuration.identifier.split('-');
        if (!proficiency) return;

        const newProficiencyLevel = this.configuration.oldProf;
        if (!newProficiencyLevel) return;

        switch (proficiencyType) {
            case 'abilities':
                return actor.updateSource({ [`system.abilities.${proficiency}.proficient`]: newProficiencyLevel });
            case 'skills':
                return actor.updateSource({ [`system.skills.${proficiency}.value`]: newProficiencyLevel });
            case 'weapon':
            case 'armor':
                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}.${proficiency}`]: newProficiencyLevel });
            case 'spellcasting':
                return actor.updateSource({ [`flags.${moduleID}.${proficiencyType}`]: newProficiencyLevel });
        }
    }

}



class ProficiencyAdvancementConfig extends dnd5e.applications.advancement.AdvancementConfig {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: `modules/${moduleID}/templates/proficiency-advancement-config.hbs`
        });
    }

    async getData() {
        const data = super.getData();

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

        data.proficiencySelect = identifierSelect.outerHTML;

        return data;
    }

    activateListeners($html) {
        super.activateListeners($html);

        const [html] = $html;

        const proficiencySelect = html.querySelector('select[name="configuration.identifier"]');
        proficiencySelect.value = this.advancement.configuration.identifier;
    }

}
