import * as __typia_transform__validateReport from "typia/lib/internal/_validateReport.js";
import * as __typia_transform__createStandardSchema from "typia/lib/internal/_createStandardSchema.js";
import * as __typia_transform__isFormatUuid from "typia/lib/internal/_isFormatUuid.js";
import * as __typia_transform__isFormatDateTime from "typia/lib/internal/_isFormatDateTime.js";
import typia, { tags } from "typia";
export const validateUsername = (() => { const __is = input => "string" === typeof input && (3 <= input.length && input.length <= 20); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => "string" === typeof input && (3 <= input.length || _report(true, {
            path: _path + "",
            expected: "string & MinLength<3>",
            value: input
        })) && (input.length <= 20 || _report(true, {
            path: _path + "",
            expected: "string & MaxLength<20>",
            value: input
        })) || _report(true, {
            path: _path + "",
            expected: "(string & MinLength<3> & MaxLength<20>)",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateRoomConfig = (() => { const _io0 = input => (undefined === input.isPrivate || "boolean" === typeof input.isPrivate) && (undefined === input.maxPlayers || "number" === typeof input.maxPlayers && (2 <= input.maxPlayers && input.maxPlayers <= 12)) && (undefined === input.wordSelectionSize || 3 === input.wordSelectionSize || 5 === input.wordSelectionSize) && (undefined === input.wordChoiceTimer || "number" === typeof input.wordChoiceTimer) && (undefined === input.drawTimer || "number" === typeof input.drawTimer) && (undefined === input.numberOfRounds || "number" === typeof input.numberOfRounds && (1 <= input.numberOfRounds && input.numberOfRounds <= 10)); const _vo0 = (input, _path, _exceptionable = true) => [undefined === input.isPrivate || "boolean" === typeof input.isPrivate || _report(_exceptionable, {
        path: _path + ".isPrivate",
        expected: "(boolean | undefined)",
        value: input.isPrivate
    }), undefined === input.maxPlayers || "number" === typeof input.maxPlayers && (2 <= input.maxPlayers || _report(_exceptionable, {
        path: _path + ".maxPlayers",
        expected: "number & Minimum<2>",
        value: input.maxPlayers
    })) && (input.maxPlayers <= 12 || _report(_exceptionable, {
        path: _path + ".maxPlayers",
        expected: "number & Maximum<12>",
        value: input.maxPlayers
    })) || _report(_exceptionable, {
        path: _path + ".maxPlayers",
        expected: "((number & Minimum<2> & Maximum<12>) | undefined)",
        value: input.maxPlayers
    }), undefined === input.wordSelectionSize || 3 === input.wordSelectionSize || 5 === input.wordSelectionSize || _report(_exceptionable, {
        path: _path + ".wordSelectionSize",
        expected: "(3 | 5 | undefined)",
        value: input.wordSelectionSize
    }), undefined === input.wordChoiceTimer || "number" === typeof input.wordChoiceTimer || _report(_exceptionable, {
        path: _path + ".wordChoiceTimer",
        expected: "(number | undefined)",
        value: input.wordChoiceTimer
    }), undefined === input.drawTimer || "number" === typeof input.drawTimer || _report(_exceptionable, {
        path: _path + ".drawTimer",
        expected: "(number | undefined)",
        value: input.drawTimer
    }), undefined === input.numberOfRounds || "number" === typeof input.numberOfRounds && (1 <= input.numberOfRounds || _report(_exceptionable, {
        path: _path + ".numberOfRounds",
        expected: "number & Minimum<1>",
        value: input.numberOfRounds
    })) && (input.numberOfRounds <= 10 || _report(_exceptionable, {
        path: _path + ".numberOfRounds",
        expected: "number & Maximum<10>",
        value: input.numberOfRounds
    })) || _report(_exceptionable, {
        path: _path + ".numberOfRounds",
        expected: "((number & Minimum<1> & Maximum<10>) | undefined)",
        value: input.numberOfRounds
    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && false === Array.isArray(input) && _io0(input); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input && false === Array.isArray(input) || _report(true, {
            path: _path + "",
            expected: "Partial<RoomConfig>",
            value: input
        })) && _vo0(input, _path + "", true) || _report(true, {
            path: _path + "",
            expected: "Partial<RoomConfig>",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateRoomId = (() => { const __is = input => "string" === typeof input && __typia_transform__isFormatUuid._isFormatUuid(input); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => "string" === typeof input && (__typia_transform__isFormatUuid._isFormatUuid(input) || _report(true, {
            path: _path + "",
            expected: "string & Format<\"uuid\">",
            value: input
        })) || _report(true, {
            path: _path + "",
            expected: "(string & Format<\"uuid\">)",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateGuessage = (() => { const _io0 = input => "string" === typeof input.playerId && "string" === typeof input.guessage && ("string" === typeof input.timestamp && __typia_transform__isFormatDateTime._isFormatDateTime(input.timestamp)); const _vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.playerId || _report(_exceptionable, {
        path: _path + ".playerId",
        expected: "string",
        value: input.playerId
    }), "string" === typeof input.guessage || _report(_exceptionable, {
        path: _path + ".guessage",
        expected: "string",
        value: input.guessage
    }), "string" === typeof input.timestamp && (__typia_transform__isFormatDateTime._isFormatDateTime(input.timestamp) || _report(_exceptionable, {
        path: _path + ".timestamp",
        expected: "string & Format<\"date-time\">",
        value: input.timestamp
    })) || _report(_exceptionable, {
        path: _path + ".timestamp",
        expected: "(string & Format<\"date-time\">)",
        value: input.timestamp
    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && _io0(input); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || _report(true, {
            path: _path + "",
            expected: "Guessage",
            value: input
        })) && _vo0(input, _path + "", true) || _report(true, {
            path: _path + "",
            expected: "Guessage",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateWord = (() => { const __is = input => "string" === typeof input; let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => "string" === typeof input || _report(true, {
            path: _path + "",
            expected: "string",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateStrokeStart = (() => { const _io0 = input => "string" === typeof input.color && "number" === typeof input.width; const _vo0 = (input, _path, _exceptionable = true) => ["string" === typeof input.color || _report(_exceptionable, {
        path: _path + ".color",
        expected: "string",
        value: input.color
    }), "number" === typeof input.width || _report(_exceptionable, {
        path: _path + ".width",
        expected: "number",
        value: input.width
    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && _io0(input); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || _report(true, {
            path: _path + "",
            expected: "__type",
            value: input
        })) && _vo0(input, _path + "", true) || _report(true, {
            path: _path + "",
            expected: "__type",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
export const validateStrokePoints = (() => { const _io0 = input => Array.isArray(input.points) && input.points.every(elem => Array.isArray(elem) && (elem.length === 2 && ("number" === typeof elem[0] && (0 <= elem[0] && elem[0] <= 1)) && ("number" === typeof elem[1] && (0 <= elem[1] && elem[1] <= 1)))); const _vo0 = (input, _path, _exceptionable = true) => [(Array.isArray(input.points) || _report(_exceptionable, {
        path: _path + ".points",
        expected: "Array<Point>",
        value: input.points
    })) && input.points.map((elem, _index2) => (Array.isArray(elem) || _report(_exceptionable, {
        path: _path + ".points[" + _index2 + "]",
        expected: "Point",
        value: elem
    })) && ((elem.length === 2 || _report(_exceptionable, {
        path: _path + ".points[" + _index2 + "]",
        expected: "[(number & Minimum<0> & Maximum<1>), (number & Minimum<0> & Maximum<1>)]",
        value: elem
    })) && [
        "number" === typeof elem[0] && (0 <= elem[0] || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][0]",
            expected: "number & Minimum<0>",
            value: elem[0]
        })) && (elem[0] <= 1 || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][0]",
            expected: "number & Maximum<1>",
            value: elem[0]
        })) || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][0]",
            expected: "(number & Minimum<0> & Maximum<1>)",
            value: elem[0]
        }),
        "number" === typeof elem[1] && (0 <= elem[1] || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][1]",
            expected: "number & Minimum<0>",
            value: elem[1]
        })) && (elem[1] <= 1 || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][1]",
            expected: "number & Maximum<1>",
            value: elem[1]
        })) || _report(_exceptionable, {
            path: _path + ".points[" + _index2 + "][1]",
            expected: "(number & Minimum<0> & Maximum<1>)",
            value: elem[1]
        })
    ].every(flag => flag)) || _report(_exceptionable, {
        path: _path + ".points[" + _index2 + "]",
        expected: "Point",
        value: elem
    })).every(flag => flag) || _report(_exceptionable, {
        path: _path + ".points",
        expected: "Array<Point>",
        value: input.points
    })].every(flag => flag); const __is = input => "object" === typeof input && null !== input && _io0(input); let errors; let _report; return __typia_transform__createStandardSchema._createStandardSchema(input => {
    if (false === __is(input)) {
        errors = [];
        _report = __typia_transform__validateReport._validateReport(errors);
        ((input, _path, _exceptionable = true) => ("object" === typeof input && null !== input || _report(true, {
            path: _path + "",
            expected: "__type",
            value: input
        })) && _vo0(input, _path + "", true) || _report(true, {
            path: _path + "",
            expected: "__type",
            value: input
        }))(input, "$input", true);
        const success = 0 === errors.length;
        return success ? {
            success,
            data: input
        } : {
            success,
            errors,
            data: input
        };
    }
    return {
        success: true,
        data: input
    };
}); })();
//# sourceMappingURL=typia.js.map