import { moduleID, lg } from './proficiency-levels.js';


Hooks.once('init', () => {
    libWrapper.register(moduleID, 'dnd5e.dataModels.advancement.TraitConfigurationData.defineSchema', newTraitConfigDataSchema, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.documents.advancement.TraitAdvancement.prototype.actorSelected', newTraitAdvancementActorSelected, 'WRAPPER');
    libWrapper.register(moduleID, 'dnd5e.documents.advancement.TraitAdvancement.prototype.apply', newTraitAdvancementAppy, 'OVERRIDE');
    libWrapper.register(moduleID, 'dnd5e.documents.advancement.TraitAdvancement.prototype.reverse', newTraitAdvancementReverse, 'OVERRIDE');
});


Hooks.on('renderTraitConfig', (app, [html], appData) => {
    const modeSelectDiv = html.querySelector('select[name="configuration.mode"]').closest('div.form-group');
    const nUpgradesDiv = document.createElement('div');
    nUpgradesDiv.classList.add('form-group');
    nUpgradesDiv.innerHTML = `
        <label>Proficiency Levels</label>
        <div class="form-fields">
            <input type="number" placeholder="1" value="${app.item.advancement.byId[app.object.id].configuration.nUpgrades}" name="configuration.nUpgrades" />
        </div>
        <p class="hint">Number of proficiency levels to gain.</p>
    `;
    modeSelectDiv.after(nUpgradesDiv);
    // modeSelectDiv.remove();
});


function newTraitConfigDataSchema(wrapped) {
    const schema = wrapped();
    schema.nUpgrades = new foundry.data.fields.NumberField({
        required: true, positive: true, integer: true, initial: 1, label: 'Number of proficiency levels to increase.'
    });
    return schema;
}

async function newTraitAdvancementActorSelected(wrapped) {
    const res = await wrapped();

    const newSelected = new Set();
    res.selected.forEach(i => {
        const type = i.split(':')[0];
        if (!['saves', 'skills', 'armor', 'weapon', 'tool'].includes(type)) newSelected.add(i);
        else res.available.add(i);
    });

    return { selected: newSelected, available: res.available };
}

async function newTraitAdvancementAppy(level, data) {
    const updates = {};
    if (!data.chosen) return;

    for (const key of data.chosen) {
        const type = key.split(':')[0];
        const keyPath = dnd5e.documents.Trait.changeKeyPath(key);
        let existingValue = updates[keyPath] ?? foundry.utils.getProperty(this.actor, keyPath);

        if (!['saves', 'skills', 'armor', 'weapon', 'tool'].includes(type)) {
            if (["Array", "Set"].includes(foundry.utils.getType(existingValue))) {
                existingValue = new Set(existingValue);
                existingValue.add(key.split(":").pop());
                updates[keyPath] = Array.from(existingValue);
            } else if ((this.configuration.mode !== "expertise") || (existingValue !== 0)) {
                updates[keyPath] = (this.configuration.mode === "default")
                    || ((this.configuration.mode === "upgrade") && (existingValue === 0)) ? 1 : 2;
            }
        } else {
            updates[keyPath] = Math.floor(this.configuration.nUpgrades + existingValue);
        }
    }

    this.actor.updateSource(updates);
    this.updateSource({ "value.chosen": Array.from(data.chosen) });
}

async function newTraitAdvancementReverse(level) {
    const updates = {};
    if (!this.value.chosen) return;

    for (const key of this.value.chosen) {
        const type = key.split(':')[0];
        const keyPath = dnd5e.documents.Trait.changeKeyPath(key);
        let existingValue = updates[keyPath] ?? foundry.utils.getProperty(this.actor, keyPath);

        if (!['saves', 'skills', 'armor', 'weapon', 'tool'].includes(type)) {
            if (["Array", "Set"].includes(foundry.utils.getType(existingValue))) {
                existingValue = new Set(existingValue);
                existingValue.delete(key.split(":").pop());
                updates[keyPath] = Array.from(existingValue);
            }

            else if (this.configuration.mode === "expertise") updates[keyPath] = 1;
            else if (this.configuration.mode === "upgrade") updates[keyPath] = existingValue === 1 ? 0 : 1;
            else updates[keyPath] = 0;
            // NOTE: When using forced expertise mode, this will not return to original value
            // if the value before being applied is 1.
        } else {
            updates[keyPath] = existingValue - this.configuration.nUpgrades;
        }
    }

    const retainedData = foundry.utils.deepClone(this.value);
    this.actor.updateSource(updates);
    this.updateSource({ "value.chosen": [] });
    return retainedData;
}