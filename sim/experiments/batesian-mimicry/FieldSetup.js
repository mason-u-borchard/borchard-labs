/**
 * FieldSetup -- pre-simulation config screen for the Batesian mimicry
 * field survey. Lets the user pick survey date, habitat, transect layout,
 * and learning options before heading into the field.
 */

import { ConfigScreen } from '../../engine/ConfigScreen.js';
import { DEFAULTS } from './config.js';

var MONTH_OPTIONS = [
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' }
];

export class FieldSetup extends ConfigScreen {

    mount(container) {
        super.mount(container);

        // Swap in a more descriptive heading
        var heading = this._el.querySelector('h3');
        if (heading) {
            heading.textContent = 'Field Survey Setup';
        }
    }

    getParams() {
        return [
            // -- Survey timing --
            {
                key: 'surveyMonth',
                label: 'Survey Month',
                type: 'select',
                options: MONTH_OPTIONS,
                default: DEFAULTS.surveyMonth,
                description: 'Spring and fall have highest salamander activity. Summer is hot and dry.'
            },
            {
                key: 'surveyDay',
                label: 'Day of Month',
                type: 'number',
                min: 1, max: 28,
                default: 15,
                description: 'Combined with month to generate weather conditions.'
            },

            // -- Site --
            {
                key: 'habitat',
                label: 'Study Site',
                type: 'select',
                options: [
                    { value: 'cove',   label: 'Cove Hardwood Forest' },
                    { value: 'mixed',  label: 'Mixed Oak Forest' },
                    { value: 'stream', label: 'Stream Corridor' }
                ],
                default: 'cove',
                description: 'Cove forests have highest salamander density. Stream corridors favor Pseudotriton and Desmognathus.'
            },

            // -- Transect layout --
            {
                key: 'coverObjectCount',
                label: 'Cover Objects per Transect',
                type: 'range',
                min: 20, max: 60, step: 5,
                default: 40,
                description: 'More objects = longer survey but more data.'
            },
            {
                key: 'transectCount',
                label: 'Number of Transects',
                type: 'select',
                options: [1, 2, 3],
                default: 2,
                description: 'Multiple transects provide replication.'
            },

            // -- ID feedback --
            {
                key: 'idFeedback',
                label: 'ID Feedback Mode',
                type: 'select',
                options: [
                    { value: 'immediate', label: 'Immediate (shows correct ID after each attempt)' },
                    { value: 'deferred',  label: 'Deferred (reveals accuracy in review)' }
                ],
                default: 'deferred',
                description: 'Deferred is more realistic. Immediate is better for learning.'
            },

            // -- Learning aids --
            {
                key: 'tutorial',
                label: 'Tutorial Mode',
                type: 'checkbox',
                default: true,
                description: 'Guided hints for the first three cover objects.'
            },
            {
                key: 'forcedEncounters',
                label: 'Guarantee Mimic & Model',
                type: 'checkbox',
                default: true,
                description: 'Ensures you find at least one Red Salamander and one Red Eft per session.'
            }
        ];
    }
}
