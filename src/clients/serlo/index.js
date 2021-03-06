'use strict';

const util = require('util');
const moment = require('moment-timezone');
const urljoin = require('url-join');
const request = require('request-promise');

const contentModel = require('./../content-model');
const helper = require('./../_helper/helper');

const BASE_URL = 'https://de.serlo.org';
const EXPORT_URL = urljoin(BASE_URL, 'entity/api/json/export/%s');

const CONTENT_TYPES = ['article', 'course', 'video', 'text-exercise'];
const CONTENT_TYPE_STANDARD_NAMES = {
    'article': 55,
    'course': 50,
    'video': 5501,
    'text-exercise': 79
};

let client = {
    getAll
};

//member functions
function getAll() {
    let requests = CONTENT_TYPES.map((type) =>
            request(util.format(EXPORT_URL, type))
            .then(response => parseLearningObjects(response, type))
        );

    return Promise.all(requests).then((content) =>
        content.reduce((x, y) => x.concat(y))
    )
}

//helper functions
function parseLearningObjects(response, contentType) {
    let content = JSON.parse(response);
    return content.map(serialization => {
        let subjectsAndTargetGroups = parseCategories(serialization.categories);
        let tags = Object.keys(serialization.keywords).map(x => serialization.keywords[x])
        let data = {
            originId: serialization.guid,
            title: serialization.title,
            url: urljoin(BASE_URL, serialization.link),
            license: ['https://creativecommons.org/licenses/by-sa/4.0/'],
            language: 'de-de',
            description: serialization.description,
            contentType: CONTENT_TYPE_STANDARD_NAMES[contentType],
            subjects: subjectsAndTargetGroups.subjects,
            targetGroups: subjectsAndTargetGroups.targetGroups,
            tags: (tags.length > 0) ? tags : null,
            restrictions: null,
            lastModified: moment.tz(serialization.lastModified.date, serialization.lastModified.timezone).toDate(),
        };

        return contentModel.getModelObject(data);
    });
}

function parseCategories(categories) {
    let subjects = [];
    let targetGroups = [];
    for (let i = 0; i < categories.length; i++) {
        let fields = categories[i].split('/');
        subjects.push(fields[0]);
        if (fields[1] !== "Deutschland") {
            continue;
        }

        if (helper.getClass(fields[4]) === '') {
            continue;
        }

        targetGroups.push({
            state: helper.getState(fields[2]),
            schoolType: helper.getSchoolType(fields[3]),
            grade: helper.getClass(fields[4])
        })
    }
    subjects = helper.getSubjects(subjects);

    if(subjects.length > 0) {
        subjects = uniq(subjects);
    } else {
        subjects = null;
    }

    if(targetGroups.length > 0) {
        targetGroups = uniq(targetGroups);
    } else {
        targetGroups = null;
    }

    return {
        subjects: subjects,
        targetGroups: targetGroups
    }
}

function uniq(a) {
    let seen = {};
    return a.filter(item => seen.hasOwnProperty(JSON.stringify(item)) ? false : (seen[JSON.stringify(item)] = true));
}

module.exports = client;
