/**
 * UB RIA Base
 * Copyright 2015 Baidu Inc. All rights reserved.
 *
 * @file 对象更新辅助方法
 * @author otakustay
 */
define(
    function (require) {
        var u = require('./util');

        var AVAILABLE_COMMANDS = {
            $set: function (oldValue, newValue) {
                return newValue;
            },

            $push: function (oldValue, newValue) {
                var result = oldValue.slice();
                result.push(newValue);
                return result;
            },

            $unshift: function (oldValue, newValue) {
                var result = oldValue.slice();
                result.unshift(newValue);
                return result;
            },

            $merge: function (oldValue, newValue) {
                return u.extend({}, oldValue, newValue);
            },

            $defaults: function (oldValue, newValue) {
                return u.defaults(u.clone(oldValue), newValue);
            },

            $invoke: function (oldValue, factory) {
                return factory(oldValue);
            }
        };

        /**
         * 不可变数据的更新辅助函数
         *
         * 用此模块的函数可以在不修改一个对象的前提下对其进行更新，并获得更新后的新对象
         *
         * @namespace update
         */
        var exports = {};

        /**
         * 根据给定的指令更新一个对象的属性，并返回更新后的新对象，原对象不会被修改
         *
         * 指令支持以下几种：
         *
         * - `$set`用于更新属性的值
         * - `$push`用于向类型为数组的属性最后位置添加值
         * - `$unshift`用于向类型为数组的属性最前位置添加值
         * - `$merge`用于在原对象上合并新属性
         * - `$invoke`用于执行一个函数获取新的属性值，该函数接收旧的属性值作为唯一的参数
         *
         * 可以一次使用多个指令更新对象：
         *
         * ```javascript
         * var newObject = update.run(
         *     source,
         *     {
         *         foo: {bar: {$set: 1}},
         *         alice: {$push: 1},
         *         tom: {jack: {$set: {x: 1}}
         *     }
         * );
         * ```
         *
         * @param {Object} source 需要更新的原对象
         * @param {Object} commands 更新的指令
         * @return {Object} 更新了属性的新对象
         */
        exports.run = function (source, commands) {
            // 可能是第一层的指令，直接对原数据进行处理，不访问任何属性
            var possibleFirstLevelCommand = u.find(
                Object.keys(AVAILABLE_COMMANDS),
                function (command) {
                    return commands.hasOwnProperty(command);
                }
            );
            if (possibleFirstLevelCommand) {
                return AVAILABLE_COMMANDS[possibleFirstLevelCommand](source, commands[possibleFirstLevelCommand]);
            }

            var result = Object.keys(commands).reduce(
                function (result, key) {
                    var propertyCommand = commands[key];
                    // 如果有我们支持的指令，则是针对这一个属性的指令，直接操作
                    var isCommand = u.any(
                        AVAILABLE_COMMANDS,
                        function (execute, command) {
                            if (propertyCommand.hasOwnProperty(command)) {
                                result[key] = execute(result[key], propertyCommand[command]);
                                return true;
                            }
                            return false;
                        }
                    );
                    // 如果没有任何指令，说明是多层的，所以递归
                    if (!isCommand) {
                        result[key] = exports.run(result[key] || {}, propertyCommand);
                    }

                    return result;
                },
                u.clone(source)
            );

            return result;
        };

        function buildPathObject(path, value) {
            if (!path) {
                return value;
            }

            if (typeof path === 'string') {
                path = [path];
            }

            var result = {};
            var current = result;
            for (var i = 0; i < path.length - 1; i++) {
                current = current[path[i]] = {};
            }
            current[path[path.length - 1]] = value;
            return result;
        }

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$set`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {*} value 更新的值
         * @return {Object} 更新后的新对象
         */
        exports.set = function (source, path, value) {
            return exports.run(source, buildPathObject(path, {$set: value}));
        };

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$push`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {*} value 更新的值
         * @return {Object} 更新后的新对象
         */
        exports.push = function (source, path, value) {
            return exports.run(source, buildPathObject(path, {$push: value}));
        };

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$unshift`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {*} value 更新的值
         * @return {Object} 更新后的新对象
         */
        exports.unshift = function (source, path, value) {
            return exports.run(source, buildPathObject(path, {$unshift: value}));
        };

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$merge`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {Object} value 更新的值
         * @return {Object} 更新后的新对象
         */
        exports.merge = function (source, path, value) {
            return exports.run(source, buildPathObject(path, {$merge: value}));
        };

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$defaults`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {Object} value 更新的值
         * @return {Object} 更新后的新对象
         */
        exports.defaults = function (source, path, value) {
            return exports.run(source, buildPathObject(path, {$defaults: value}));
        };

        /**
         * 快捷更新属性的方法，效果相当于使用`update`方法传递`$invoke`指令
         *
         * @param {Object} source 待更新的原对象
         * @param {string?|Array.<string>} path 属性路径，当路径深度大于1时使用数组，为空或非值则直接对`source`对象操作
         * @param {Function} factory 产生新属性值的工厂函数，接受旧属性值为参数
         * @return {Object} 更新后的新对象
         */
        exports.invoke = function (source, path, factory) {
            return exports.run(source, buildPathObject(path, {$invoke: factory}));
        };

        return exports;
    }
);
