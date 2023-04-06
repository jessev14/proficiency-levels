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
                config: ProficiencyAdvancementConfig,
                flow: ProficiencyAdvancementFlow
            }
        });
    }

    async apply(level, data) {
        debugger
        const { actor } = this;

        const proficiencies = Object.values(data);
        for (const currentProficiency of proficiencies) {
            const [proficiencyType, proficiency] = currentProficiency.split('-');
            if (!proficiency) return;

            const levelsToIncrease = parseInt(this.configuration.increase) || 1;
            let oldProficiencyLevel, newProficiencyLevel;
            switch (proficiencyType) {
                case 'abilities':
                    oldProficiencyLevel = actor.system.abilities[proficiency].proficient || 0;
                    await this.updateSource({ [`configuration.oldProf.${currentProficiency}`]: oldProficiencyLevel });
                    newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                    await actor.updateSource({ [`system.abilities.${proficiency}.proficient`]: newProficiencyLevel });
                    break;
                case 'skills':
                    oldProficiencyLevel = actor.flags[moduleID]?.system?.skills[proficiency]?.value || 0;
                    await this.updateSource({ [`configuration.oldProf.${currentProficiency}`]: oldProficiencyLevel });
                    newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                    await actor.updateSource({ [`system.skills.${proficiency}.value`]: newProficiencyLevel });
                    break;
                case 'weapon':
                case 'armor':
                    oldProficiencyLevel = actor.flags[moduleID]?.[proficiencyType]?.[proficiency] || 0;
                    await this.updateSource({ [`configuration.oldProf.${currentProficiency}`]: oldProficiencyLevel });
                    newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                    await actor.updateSource({ [`flags.${moduleID}.${proficiencyType}.${proficiency}`]: newProficiencyLevel });
                    break;
                case 'spellcasting':
                    oldProficiencyLevel = actor.flags[moduleID]?.spellcasting || 0;
                    await this.updateSource({ [`configuration.oldProf.${currentProficiency}`]: oldProficiencyLevel });
                    newProficiencyLevel = Math.min(oldProficiencyLevel + levelsToIncrease, 7);

                    await actor.updateSource({ [`flags.${moduleID}.${proficiencyType}`]: newProficiencyLevel });
                    break;
            }
        }
    }

    async reverse(level) {
        const { actor } = this;

        const proficiencies = Object.keys(this.configuration.oldProf || {});
        for (const currentProficiency of proficiencies) {
            const [proficiencyType, proficiency] = currentProficiency.split('-');
            if (!proficiency) return;

            const newProficiencyLevel = this.configuration.oldProf[currentProficiency];
            switch (proficiencyType) {
                case 'abilities':
                    await actor.updateSource({ [`system.abilities.${proficiency}.proficient`]: newProficiencyLevel });
                    break;
                case 'skills':
                    await actor.updateSource({ [`system.skills.${proficiency}.value`]: newProficiencyLevel });
                    break;
                case 'weapon':
                case 'armor':
                    await actor.updateSource({ [`flags.${moduleID}.${proficiencyType}.${proficiency}`]: newProficiencyLevel });
                    break;
                case 'spellcasting':
                    await actor.updateSource({ [`flags.${moduleID}.${proficiencyType}`]: newProficiencyLevel });
                    break;
            }
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

        data.proficencyTypeSelect = {
            ability: 'Saving Throws',
            skill: 'Skills',
            weapon: 'Weapons',
            armor: 'Armor',
            spellcasting: 'Spellcasting'
        };

        return data;
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
        const { type, count, increase } = advancement.configuration;

        data.increase = increase || 1;
        data.content = ``;

        for (let i = 0; i < count; i++) {
            const select = document.createElement('select');
            select.name = i;

            switch (type) {
                case 'ability':
                    for (const [k, v] of Object.entries(CONFIG.DND5E.abilities)) {
                        const option = document.createElement('option');
                        option.value = `abilities-${k}`;
                        option.text = v;
                        select.add(option);
                    }
                    data.content += `
                        <div>
                            ${select.outerHTML}
                        </div>
                    `;
                    break;
                case 'skill':
                    for (const [k, v] of Object.entries(CONFIG.DND5E.skills)) {
                        const option = document.createElement('option');
                        option.value = `skills-${k}`;
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
                case 'armor':
                    const unarmoredOption = document.createElement('option');
                    unarmoredOption.value = 'armor-unarmored';
                    unarmoredOption.text = 'Unarmored';
                    select.add(unarmoredOption);

                    const armorTraits = await dnd5e.documents.Trait.choices('armor');
                    processTraits(armorTraits, 'armor', select);
                    
                    data.content += `
                        <div>
                            ${select.outerHTML}
                        </div>
                    `;
                    break;
                case 'spellcasting':
                    data.content += `
                    <div>
                        <select name="0">
                            <option value="spellcasting-spellcasting" disabled>Spellcasting</option>;
                        </select>
                    </div>
                    `;
                    break;
            }

            if (type === 'spellcasting') break;
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
