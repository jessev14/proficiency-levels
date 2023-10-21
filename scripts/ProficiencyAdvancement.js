import { proficiencyBonusMap } from './CONST.js';
import { moduleID } from './main.js';

const lg = x => console.log(x);

export class ProficiencyAdvancement extends dnd5e.documents.advancement.Advancement {

    static get metadata() {
        return foundry.utils.mergeObject(super.metadata, {
            dataModels: {},
            order: 70,
            title: 'Proficiency Level',
            hint: 'Upgrade a selected proficiency level when the character reaches a certain level.',
            multiLevel: true,
            apps: {
                config: ProficiencyAdvancementConfig,
                flow: ProficiencyAdvancementFlow
            }
        });
    }

    async apply(level, data) {
        const { actor } = this;

        const proficiencyType = this.configuration.type;
        const levelsToIncrease = this.configuration.increase;
        const proficiencies = Object.values(data);
        const updates = {};

        switch (proficiencyType) {
            case 'skill':
                for (const proficiency of proficiencies) {
                    updates[`flags.${moduleID}.skills.${proficiency}.value`] = (actor.getFlag(moduleID, `skills.${proficiency}.value`) || 0) + levelsToIncrease;
                }
                break
        }
        actor.updateSource(updates);
        this.updateSource({value: data});
    }

    async reverse(level) {
        const { actor } = this;

        const proficencyType = this.configuration.type;
        const levelsToIncrease = this.configuration.increase;
        const proficiencies = Object.values(this.value);
        const updates = {};
        switch (proficencyType) {
            case 'skill':
                for (const proficiency of proficiencies) {
                    updates[`flags.${moduleID}.skills.${proficiency}.value`] = actor.getFlag(moduleID, `skills.${proficiency}.value`) - levelsToIncrease;
                }
                break;
        }

        await actor.updateSource(updates);
        this.updateSource({value: {}});
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
        data.showLevelSelector = true;


        data.armorTypes = `<option value="unarmored">Unarmored</option>`
        const armorTraits = await dnd5e.documents.Trait.choices('armor');
        processTraits(armorTraits, 'armor');

        function processTraits(traitsObj, type) {
            for (const [key, trait] of Object.entries(traitsObj)) {
                const option = `<option value="${key}">${trait.label}</option>`;
                data.armorTypes += option;

                const children = trait.children || {};
                processTraits(children, type);
            }
        }

        data.abilities = ``;
        for (const [abilityKey, ability] of Object.entries(CONFIG.DND5E.abilities)) {
            data.abilities += `<option value="${abilityKey}">${ability.label}</option>`;
        }

        return data;
    }

    activateListeners($html) {
        super.activateListeners($html);
        const [html] = $html;

        const profTypeSelect = html.querySelector('select[name="configuration.type"]');
        profTypeSelect.value = this.advancement.configuration.type;

        for (const inputDiv of html.querySelectorAll('div.selection')) {
            if (
                (inputDiv.id === profTypeSelect.value)
                || (inputDiv.id === 'number-of-proficiencies' && ['skills', 'weapons'].includes(this.advancement.configuration.type))
            ) inputDiv.style.display = 'flex'; 

            if (inputDiv.querySelector('select')) inputDiv.querySelector('select').value = this.advancement.configuration[inputDiv.id];
        }
    }

}


class ProficiencyAdvancementFlow extends dnd5e.applications.advancement.AdvancementFlow {

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: `modules/${moduleID}/templates/proficiency-advancement-flow.hbs`
        });
    }

    async getData() {
        const data = super.getData();

        const { advancement } = this;
        let { type, count, increase } = advancement.configuration;
        const [proficiencyType, proficiencySelection] = type.split('-');

        count = count || 1;
        data.increase = increase || 1;
        data.content = ``;

        if (['spellcasting', 'abilities', 'armor'].includes(proficiencyType)) {
            switch (proficiencyType) {
                case 'spellcasting':
                    data.content += `Increase spellcasting proficiency by ${data.increase}.`;
                    break;
                case 'abilities':
                    data.content += `Increase ${CONFIG.DND5E.abilities[proficiencySelection]?.label} saving throw proficiency by ${data.increase}.`;
                    break;
                case 'armor':
                    data.content += `Increase ${proficiencySelection} proficiency by ${data.increase}.`;
                    break;
            }
        } else {
            data.content += `Increase selected proficiencies by ${data.increase}.`;

            for (let i = 0; i < count; i++) {
                const select = document.createElement('select');
                select.name = i;
    
                switch (proficiencyType) {
                    case 'skill':
                        for (const [k, v] of Object.entries(CONFIG.DND5E.skills)) {
                            const option = document.createElement('option');
                            option.value = `${k}`;
                            option.text = v.label;
                            select.add(option);
                        }
                        data.content += `
                            <div>
                                ${select.outerHTML}
                            </div>
                        `;
                        break;
                    case 'weapon':
                        const weaponTraits = await dnd5e.documents.Trait.choices('weapon');
                        processTraits(weaponTraits, 'weapon', select);
                        data.content += `
                            <div>
                                ${select.outerHTML}
                            </div>
                        `;
                        break;
                }
            }
        }

        function processTraits(traitsObj, type, selectParent) {
            for (const [key, trait] of Object.entries(traitsObj)) {
                const option = document.createElement('option');
                option.value = `${type}-${key}`;
                option.text = trait.label;
                selectParent.add(option);

                const children = trait.children || {};
                processTraits(children, type, selectParent);
            }
        }

        return data;
    }

    activateListeners($html, secondPass = false) {
        super.activateListeners($html);

        const [html] = $html;

        const selects = html.querySelectorAll('select');

        if (!secondPass) {
            for (let i = 0; i < selects.length; i++) {
                selects[i].selectedIndex = i;
            }
        }

        for (const select of selects) {
            for (const option of select.querySelectorAll('option')) option.disabled = false;

            for (const otherSelect of selects) {
                if (select === otherSelect) continue;

                const otherSelectValue = otherSelect.value;
                const option = select.querySelector(`option[value="${otherSelectValue}"]`);
                if (!option) continue;

                option.disabled = true;
            }

            select.addEventListener('change', () => this.activateListeners($html, true));
        }
    }

}
