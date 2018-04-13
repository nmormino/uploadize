(function ( $ ) {
 
    $.fn.uploadize = function(config) {

        var url = config.url;
        var completed = (typeof config.completed === 'function' ? config.completed : undefined );
        var started = (typeof config.started === 'function' ? config.started : undefined );
        var ended = (typeof config.ended === 'function' ? config.ended : undefined );
        var failed = (typeof config.failed === 'function' ? config.failed : undefined );
        var cancelled = (typeof config.cancelled === 'function' ? config.cancelled : undefined );
        var buttonText = (config.buttonText ? config.buttonText : 'Select File' );
        var buttonClass = (config.buttonClass ? config.buttonClass : 'btn' );
        var chunkSize = (config.chunkSize ? config.chunkSize : 128000); //bytes
        var fieldName = $(this).attr('name');
        var fileTypes = ( config.fileTypes ? config.fileTypes : ['image/jpeg', 'image/png', 'image/gif']);
        var maxFileSize = (config.maxFileSize ? config.maxFileSize : 2097152 );
        //some defaults
        var uploadize = this;
        var cancelledFiles = [];

        var processQueue = function(fieldId, files){
            
            $.each(files, function(key, file){

                if(file)
                {
                    $('#uploadize-img-'+file.id).removeClass('uploadize-pending').addClass('uploadize-uploading');                
                    uploadFile(fieldId, file, 0);    
                }

            });


        }

        function uploadFile(fieldId, file, chunk) {

            if($.inArray(file.id, cancelledFiles) === -1)
            {
                var formData = new FormData();

                formData.append('name', file.name);
                formData.append('hash', file.hash);
                formData.append('part', (chunk+1));
                formData.append('whole', file.chunks.length);
                formData.append('piece', file.chunks[chunk]);

                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.onload = function(e) {

                    $('#uploadize-progress-'+file.id).css('width', (((chunk+1)/file.chunks.length)*100)+'%');

                    if(file.chunks[chunk+1] != undefined)
                    {
                        uploadFile(fieldId, file, chunk+1);
                    }
                    else
                    {
                        $('#uploadize-'+file.id+' .uploadize-status').addClass('message').html('File upload complete.');
                        $('#uploadize-'+file.id+' .cancel').remove();

                        if (typeof completed === 'function') {
                            var data = JSON.parse(e.srcElement.response);
                            data.fieldId = fieldId;
                            data.fileId = file.id;
                            completed(data);
                        }

                    }
                };

                xhr.send(formData);  // multipart/form-data
            }
        }

        function beginUploadProcess(field)
        {
            //define some variables
            field = $(field);
            var fieldId = field.attr('id');
            var fileQueue = [];
            var files = field[0].files;
            
            if (typeof started === 'function') {
                started({fieldId:fieldId, files:files});
            }

            $.each(files, function(fileIndex, file){

                var chunkIt = function() {

                    var fileId = fieldId+'-'+hash;
                    var totalChunks = Math.ceil(file.size/chunkSize);
                    var fileHTML =  '<div id="uploadize-'+fileId+'" class="uploadize-row uploadize-pending">'+
                                        '<div class="uploadize-filename">'+file.name+'</div>'+
                                        '<div class="uploadize-status">'+
                                            '<div id="uploadize-progress-'+fileId+'" class="uploadize-progress"></div>'+
                                            '<div class="cancel cancel-'+fileId+'"></div>'+
                                        '</div>'+
                                    '</div>';
                    field.parent().append(fileHTML);
                    
                    if(fileTypes.length > 0 && $.inArray(file.type, fileTypes) === -1)
                    {
                        $('#uploadize-'+fileId+' .uploadize-status').addClass('error').html('FAILED: This file type is not allowed.');
                        $('#uploadize-'+fileId+' .cancel').remove();

                        totalChunks = 0;

                        delete files[fileIndex];
                        cancelledFiles.push(fileId);
                        fileQueue.push(false);
                        if (typeof failed === 'function') {
                            failed({fileId:fileId, fieldId:fieldId});
                        }
                    }
                    else if(file.size > maxFileSize){
                        var mb = maxFileSize/1024/1024 
                        $('#uploadize-'+fileId+' .uploadize-status').addClass('error').html('FAILED: This file exceeds the '+mb+'mb file size limit.');
                        $('#uploadize-'+fileId+' .cancel').remove();

                        totalChunks = 0;

                        delete files[fileIndex];
                        cancelledFiles.push(fileId);
                        fileQueue.push(false);
                        if (typeof failed === 'function') {
                            failed({fileId:fileId, fieldId:fieldId});
                        }
                    }
                    else
                    {
                        //cancel button
                        $('.cancel-'+fileId).click(function(data){

                            delete files[fileIndex];
                            cancelledFiles.push(fileId);
                            $.post(url, {cancel:true, name:file.name, hash:hash}, function(data){ 
                                
                                $('#uploadize-'+fileId+' .uploadize-status').addClass('message').html('This file upload has been cancelled.');
                                $('#uploadize-'+fileId+' .cancel').remove();

                            }, 'json');

                            if (typeof cancelled === 'function') {
                                cancelled({filename:file.name, hash:hash, fieldId:fieldId, fileId:fileId});
                            }
                        });

                        var chunks = [];
                        var chunker = function(file, offset)
                        {
                            chunks.push(file.slice(offset, offset+chunkSize,'application/octet-stream'));

                            if(chunks.length < totalChunks)
                            {
                                chunker(file, offset+chunkSize);    
                            }
                            else
                            {
                                fileQueue.push({id:fileId, fieldId:fieldId, hash:hash, name:file.name, chunks:chunks, size:file.size, type:file.type, file:file});        
                            }
                        }

                        chunker(file, 0);
                    }

                    if(files.length == fileQueue.length)
                    {
                        processQueue(fieldId, fileQueue);
                    }
                }

                var hash = sha1(JSON.stringify(file)+performance.now());
                chunkIt();
            });
        }

        function generateContainer(index, container)
        {
            fieldId = window.performance.now().toString().replace(/\./g,'-');
            field = $('<input type="file" multiple>');
            field.attr('id', 'uploadize-'+fieldId);
            field.attr('data-id', fieldId);
            field.css('display', 'none');
            $(container).append(field);

            $('#label-'+index).attr('for', 'uploadize-'+fieldId);

            field.change(function(e){
                e.preventDefault();
                beginUploadProcess(this);
                fieldId = generateContainer(index, container);
            });

            return fieldId;
        }

        function createUploadBlock(index, container)
        {
            $(container).html('<div class="uploadize"></div>');
            container = $(container).find('.uploadize');

            var button = $('<label>');
            button.addClass(buttonClass);
            button.text(buttonText);
            button.attr('id', 'label-'+index);
            button.wrap('<div class="uploadize-button">');
            button.appendTo(container);
            
            
            generateContainer(index, container[0]);
        }

        $(this).each(function(index, field) {
            createUploadBlock(index, field);
        });
        
    }
})(jQuery);