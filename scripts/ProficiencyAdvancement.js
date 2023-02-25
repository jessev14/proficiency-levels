import { moduleID } from './main.js';

export class ProficiencyAdvancement extends dnd5e.documents.advancement.Advancement {
    
    static get metadata() {
        return foundry.utils.mergeObject(super.metadata, {

        });
    }
}
