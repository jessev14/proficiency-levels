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

