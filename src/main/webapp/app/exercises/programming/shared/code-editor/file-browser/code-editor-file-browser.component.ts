import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, map as rxMap, switchMap, tap } from 'rxjs/operators';
import { compose, filter, fromPairs, toPairs } from 'lodash/fp';
import { TreeviewComponent, TreeviewConfig, TreeviewHelper, TreeviewItem } from 'ngx-treeview';
import { Interactable } from '@interactjs/core/Interactable';
import interact from 'interactjs';
import { textFileExtensions } from './text-files.json';
import {
    CommitState,
    CreateFileChange,
    EditorState,
    FileChange,
    FileType,
    GitConflictState,
    RenameFileChange,
} from 'app/exercises/programming/shared/code-editor/model/code-editor.model';
import { CodeEditorFileService } from 'app/exercises/programming/shared/code-editor/service/code-editor-file.service';
import { CodeEditorConflictStateService } from 'app/exercises/programming/shared/code-editor/service/code-editor-conflict-state.service';
import { CodeEditorRepositoryFileService, CodeEditorRepositoryService } from 'app/exercises/programming/shared/code-editor/service/code-editor-repository.service';
import { CodeEditorStatusComponent } from 'app/exercises/programming/shared/code-editor/status/code-editor-status.component';
import { CodeEditorFileBrowserDeleteComponent } from 'app/exercises/programming/shared/code-editor/file-browser/code-editor-file-browser-delete';
import { IFileDeleteDelegate } from 'app/exercises/programming/shared/code-editor/file-browser/code-editor-file-browser-on-file-delete-delegate';

@Component({
    selector: 'jhi-code-editor-file-browser',
    templateUrl: './code-editor-file-browser.component.html',
    styleUrls: ['./code-editor-file-browser.scss'],
    providers: [NgbModal],
})
export class CodeEditorFileBrowserComponent implements OnInit, OnChanges, AfterViewInit, IFileDeleteDelegate {
    CommitState = CommitState;
    FileType = FileType;

    @ViewChild('status', { static: false }) status: CodeEditorStatusComponent;
    @ViewChild('treeview', { static: false }) treeview: TreeviewComponent;

    @Input()
    get selectedFile(): string | undefined {
        return this.selectedFileValue;
    }
    @Input() disableActions = false;
    @Input()
    unsavedFiles: string[];
    @Input()
    errorFiles: string[];
    @Input()
    editorState: EditorState;
    @Input()
    get commitState() {
        return this.commitStateValue;
    }
    @Input()
    isTutorAssessment = false;
    @Input()
    highlightFileChanges = false;
    @Output()
    onToggleCollapse = new EventEmitter<{ event: any; horizontal: boolean; interactable: Interactable; resizableMinWidth?: number; resizableMinHeight?: number }>();
    @Output()
    onFileChange = new EventEmitter<[string[], FileChange]>();
    @Output()
    selectedFileChange = new EventEmitter<string | undefined>();
    @Output()
    commitStateChange = new EventEmitter<CommitState>();
    @Output()
    onError = new EventEmitter<string>();

    isLoadingFiles: boolean;
    selectedFileValue?: string;
    commitStateValue: CommitState;
    repositoryFiles: { [fileName: string]: FileType };
    repositoryFilesWithInformationAboutChange: { [fileName: string]: boolean } | undefined;
    filesTreeViewItem: TreeviewItem[];
    compressFolders = true;

    @ViewChild('renamingInput', { static: false }) renamingInput: ElementRef;
    @ViewChild('creatingInput', { static: false }) creatingInput: ElementRef;

    // Triple: [filePath, fileName, fileType]
    renamingFile?: [string, string, FileType];
    // Tuple: [filePath, fileType]
    creatingFile?: [string, FileType];

    /** Provide basic configuration for the TreeView (ngx-treeview) **/
    treeviewConfig = TreeviewConfig.create({
        hasAllCheckBox: false,
        hasFilter: false,
        hasCollapseExpand: false,
        decoupleChildFromParent: false,
        // Default limit is 500, as our styling makes tree item relatively large, we need to increase it a lot
        maxHeight: 5000,
    });

    /** Resizable constants **/
    resizableMinWidth = 100;
    interactResizable: Interactable;

    gitConflictState: GitConflictState;
    conflictSubscription: Subscription;

    set selectedFile(file: string | undefined) {
        this.selectedFileValue = file;
        this.selectedFileChange.emit(this.selectedFile);
    }

    set commitState(commitState: CommitState) {
        this.commitStateValue = commitState;
        this.commitStateChange.emit(commitState);
    }

    constructor(
        public modalService: NgbModal,
        private repositoryFileService: CodeEditorRepositoryFileService,
        private repositoryService: CodeEditorRepositoryService,
        private fileService: CodeEditorFileService,
        private conflictService: CodeEditorConflictStateService,
    ) {}

    ngOnInit(): void {
        this.conflictSubscription = this.conflictService.subscribeConflictState().subscribe((gitConflictState: GitConflictState) => {
            // When the git conflict was resolved, unset the selectedFile, as it can't be assured that it still exists.
            if (this.gitConflictState === GitConflictState.CHECKOUT_CONFLICT && gitConflictState === GitConflictState.OK) {
                this.selectedFile = undefined;
            }
            this.gitConflictState = gitConflictState;
        });
    }

    /**
     * @function ngAfterViewInit
     * @desc After the view was initialized, we create an interact.js resizable object,
     *       designate the edges which can be used to resize the target element and set min and max values.
     *       The 'resizemove' callback function processes the event values and sets new width and height values for the element.
     */
    ngAfterViewInit(): void {
        this.resizableMinWidth = window.screen.width / 6;
        this.interactResizable = interact('.resizable-filebrowser');
    }

    /**
     * @function ngOnInit
     * @desc When the commitState is undefined, fetch the repository status and load the files if possible.
     * When this is done, render the file tree.
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        if (
            (changes.commitState && changes.commitState.previousValue !== CommitState.UNDEFINED && this.commitState === CommitState.UNDEFINED) ||
            (changes.editorState && changes.editorState.previousValue === EditorState.REFRESHING && this.editorState === EditorState.CLEAN)
        ) {
            this.initializeComponent();
        } else if (changes.selectedFile && changes.selectedFile.currentValue) {
            this.renamingFile = undefined;
            this.setupTreeview();
        }
    }

    initializeComponent = () => {
        this.isLoadingFiles = true;
        // We need to make sure to not trigger multiple requests on the git repo at the same time.
        // This is why we first wait until the repository state was checked and then load the files.
        this.checkIfRepositoryIsClean()
            .pipe(
                tap((commitState) => {
                    this.commitState = commitState;
                }),
                switchMap(() => {
                    if (this.commitState === CommitState.COULD_NOT_BE_RETRIEVED) {
                        return throwError('couldNotBeRetrieved');
                    } else if (this.commitState === CommitState.CONFLICT) {
                        this.conflictService.notifyConflictState(GitConflictState.CHECKOUT_CONFLICT);
                        return throwError('repositoryInConflict');
                    }
                    return this.loadFiles();
                }),
                tap((files) => {
                    this.repositoryFiles = files;
                    this.unsavedFiles = [];
                }),
                switchMap(() => {
                    if (this.isTutorAssessment && this.highlightFileChanges) {
                        return this.loadFilesWithInformationAboutChange();
                    } else {
                        return of(undefined);
                    }
                }),
                tap((filesWithInfoAboutChange) => {
                    this.repositoryFilesWithInformationAboutChange = filesWithInfoAboutChange;
                    this.isLoadingFiles = false;
                    this.setupTreeview();
                }),
            )
            .subscribe(
                () => {},
                (error) => {
                    this.isLoadingFiles = false;
                    this.onError.emit(error);
                },
            );
    };

    /**
     * @function checkIfRepositoryIsClean
     * @desc Calls the repository service to see if the repository has uncommitted changes
     */
    checkIfRepositoryIsClean = (): Observable<CommitState> => {
        return this.repositoryService.getStatus().pipe(
            rxMap((res) => {
                // The server sends us the CommitState, however we need to type it here by finding it in the client commitStates.
                const mappedCommitState = Object.values(CommitState).find((commitState) => commitState === res.repositoryStatus);
                // This should not happen, but needs to be done so that the compiler is satisfied.
                return mappedCommitState || CommitState.COULD_NOT_BE_RETRIEVED;
            }),
            catchError(() => of(CommitState.COULD_NOT_BE_RETRIEVED)),
        );
    };

    handleFileChange(fileChange: FileChange) {
        if (fileChange instanceof CreateFileChange) {
            this.repositoryFiles = { ...this.repositoryFiles, [fileChange.fileName]: fileChange.fileType };
        } else {
            this.repositoryFiles = this.fileService.updateFileReferences(this.repositoryFiles, fileChange);
        }
        this.setupTreeview();
        this.onFileChange.emit([Object.keys(this.repositoryFiles), fileChange]);
    }

    /**
     * @function onFileDeleted
     * @desc Emmiter function for when a file was deleted; notifies the parent component
     * @param fileChange
     */
    onFileDeleted(fileChange: FileChange) {
        this.handleFileChange(fileChange);
    }

    /**
     * @function handleNodeSelected
     * @desc Callback function for when a node in the file tree view has been selected
     * @param item: Corresponding event object, holds the selected TreeViewItem
     */
    handleNodeSelected(item: TreeviewItem) {
        if (item && item.value !== this.selectedFile) {
            item.checked = true;
            // If we had selected a file prior to this, we "uncheck" it
            if (this.selectedFile) {
                const priorFileSelection = TreeviewHelper.findItemInList(this.filesTreeViewItem, this.selectedFile);
                // Avoid issues after file deletion
                if (priorFileSelection) {
                    priorFileSelection.checked = false;
                }
            }
            // Inform parent editor component about the file selection change
            this.selectedFile = item.value;
        }
    }

    toggleTreeCompress() {
        this.compressFolders = !this.compressFolders;
        this.setupTreeview();
    }

    /**
     * @function setupTreeView
     * @desc Processes the file array, compresses it and then transforms it to a TreeViewItem
     */
    setupTreeview() {
        let tree = this.buildTree(Object.keys(this.repositoryFiles).sort());
        if (this.compressFolders) {
            tree = tree.map(this.compressTree.bind(this));
        }
        this.filesTreeViewItem = this.transformTreeToTreeViewItem(tree);
    }

    /**
     * @function transformTreeToTreeViewItem
     * @desc Converts a parsed filetree to a TreeViewItem[] which will then be used by the Treeviewer (ngx-treeview)
     * @param tree: Filetree obtained by parsing the repository file list
     */
    transformTreeToTreeViewItem(tree: any): TreeviewItem[] {
        const treeViewItem = new Array<TreeviewItem>();
        for (const node of tree) {
            treeViewItem.push(new TreeviewItem(node));
        }
        return treeViewItem;
    }

    /**
     * @function buildTree
     * @desc Parses the provided list of repository files
     * @param files {array of strings} Filepath strings to process
     * @param tree {array of objects} Current tree structure
     * @param folder {string} Folder name
     */
    buildTree(files: string[], tree?: any[], folder?: File) {
        /**
         * Initialize tree if empty
         */
        tree = tree || [];

        /**
         * Loop through our file array
         */
        for (let file of files) {
            // Remove leading and trailing spaces
            file = file.replace(/^\/|\/$/g, '');
            // Split file path by slashes
            const fileSplit = file.split('/');
            // Check if the first path part is already in our current tree
            let node = tree.find((element) => element.text === fileSplit[0]);
            // Path part doesn't exist => add it to tree
            if (!node) {
                node = {
                    text: fileSplit[0],
                };
                tree.push(node);
            }

            // Remove first path part from our file path
            fileSplit.shift();

            if (fileSplit.length > 0) {
                // Directory node
                node.checked = false;
                // Recursive function call to process children
                node.children = this.buildTree([fileSplit.join('/')], node.children, folder ? folder + '/' + node.text : node.text);
                node.folder = node.text;
                node.value = folder ? `${folder}/${node.folder}` : node.folder;
            } else {
                // File node
                node.folder = folder;
                node.file = (folder ? folder + '/' : '') + node.text;
                node.value = node.file;
                node.checked = false;

                // Currently processed node selected?
                if (node.file === this.selectedFile) {
                    folder = node.folder;
                    node.checked = true;
                }
            }
        }
        return tree;
    }

    /**
     * @function compressTree
     * @desc Compresses the tree obtained by buildTree() to not contain nodes with only one directory child node
     * @param node Tree node
     */
    compressTree(node: any): any {
        if (node.children && node.children.length === 1 && node.children[0].children) {
            return this.compressTree({ ...node.children[0], text: node.text + '/' + node.children[0].text });
        } else if (node.children) {
            return { ...node, children: node.children.map(this.compressTree.bind(this)) };
        } else {
            return node;
        }
    }

    /**
     * @function toggleEditorCollapse
     * @desc Calls the parent (editorComponent) toggleCollapse method
     * @param $event
     */
    toggleEditorCollapse($event: any) {
        this.onToggleCollapse.emit({ event: $event, horizontal: true, interactable: this.interactResizable, resizableMinWidth: this.resizableMinWidth });
    }

    /**
     * Rename the file (if new fileName is different than old fileName and new fileName is not empty)
     * and emit the changes to the parent.
     * After rename the rename state is exited.
     **/
    onRenameFile($event: any) {
        const newFileName: string = $event as string;
        // It is possible, that multiple events fire at once and come back when the creation mode is already turned off.
        if (!this.renamingFile) {
            return;
        }
        const [filePath, , fileType] = this.renamingFile;
        let newFilePath: any = filePath.split('/');
        newFilePath[newFilePath.length - 1] = newFileName;
        newFilePath = newFilePath.join('/');

        if (Object.keys(this.repositoryFiles).includes(newFilePath)) {
            this.onError.emit('fileExists');
            return;
        } else if (newFileName.split('.').length > 1 && !textFileExtensions.includes(newFileName.split('.').pop()!)) {
            this.onError.emit('unsupportedFile');
            return;
        }

        this.renameFile(filePath, newFileName).subscribe(
            () => {
                this.handleFileChange(new RenameFileChange(fileType, filePath, newFilePath));
                this.renamingFile = undefined;
            },
            () => this.onError.emit('fileOperationFailed'),
        );
    }

    /**
     * Enter rename file mode and focus the created input.
     **/
    setRenamingFile(item: TreeviewItem) {
        this.renamingFile = [item.value, item.text, this.repositoryFiles[item.value]];
    }

    /**
     * Set renamingFile to undefined to make the input disappear.
     **/
    clearRenamingFile() {
        this.renamingFile = undefined;
    }

    /**
     * Create a file with the value of the creation input.
     **/
    onCreateFile(fileName: string) {
        // It is possible, that multiple events fire at once and come back when the creation mode is already turned off.
        if (!this.creatingFile) {
            return;
        }
        const [folderPath, fileType] = this.creatingFile;

        if (fileName.split('.').length > 1 && !textFileExtensions.includes(fileName.split('.').pop()!)) {
            this.onError.emit('unsupportedFile');
            return;
        } else if (Object.keys(this.repositoryFiles).includes(folderPath ? [folderPath, fileName].join('/') : fileName)) {
            this.onError.emit('fileExists');
            return;
        }

        const file = folderPath ? `${folderPath}/${fileName}` : fileName;
        if (fileType === FileType.FILE) {
            this.createFile(file).subscribe(
                () => {
                    this.handleFileChange(new CreateFileChange(FileType.FILE, file));
                    this.creatingFile = undefined;
                },
                () => this.onError.emit('fileOperationFailed'),
            );
        } else {
            this.createFolder(file).subscribe(
                () => {
                    this.handleFileChange(new CreateFileChange(FileType.FOLDER, file));
                    this.creatingFile = undefined;
                },
                () => this.onError.emit('fileOperationFailed'),
            );
        }
    }

    /**
     * Enter rename file mode and focus the created input.
     **/
    setCreatingFile({ item: { value: folder }, fileType }: { item: TreeviewItem; fileType: FileType }) {
        this.creatingFile = [folder, fileType];
    }

    setCreatingFileInRoot(fileType: FileType) {
        this.creatingFile = ['', fileType];
    }

    /**
     * Set creatingFile to undefined to make the input disappear.
     **/
    clearCreatingFile() {
        this.creatingFile = undefined;
    }

    /**
     * Load files from the participants repository.
     * Files that are not relevant for the conduction of the exercise are removed from result.
     */
    loadFiles = (): Observable<{ [fileName: string]: FileType }> => {
        return this.repositoryFileService.getRepositoryContent().pipe(
            rxMap((files) =>
                compose(
                    fromPairs,
                    // Filter root folder
                    filter(([value]) => value),
                    // Filter Readme file that was historically in the student's assignment repo
                    filter(([value]) => !value.includes('README.md')),
                    // Remove binary files as they can't be displayed in an editor
                    filter(([filename]) => {
                        const fileSplit = filename.split('.');
                        // Either the file has no ending or the file ending is allowed
                        return fileSplit.length === 1 || textFileExtensions.includes(fileSplit.pop()!);
                    }),
                    toPairs,
                )(files),
            ),
            catchError(() => throwError('couldNotBeRetrieved')),
        );
    };

    loadFilesWithInformationAboutChange(): Observable<{ [fileName: string]: boolean }> {
        return this.repositoryFileService.getFilesWithInformationAboutChange().pipe(
            rxMap((files) =>
                compose(
                    fromPairs,
                    // Filter Readme file that was historically in the student's assignment repo
                    filter(([value]) => !value.includes('README.md')),
                    // Remove binary files as they can't be displayed in an editor
                    filter(([filename]) => {
                        const fileSplit = filename.split('.');
                        // Either the file has no ending or the file ending is allowed
                        return fileSplit.length === 1 || textFileExtensions.includes(fileSplit.pop()!);
                    }),
                    toPairs,
                )(files),
            ),
            catchError(() => throwError('couldNotBeRetrieved')),
        );
    }

    renameFile = (filePath: string, fileName: string): Observable<void> => {
        return this.repositoryFileService.renameFile(filePath, fileName);
    };

    createFile = (fileName: string): Observable<void> => {
        return this.repositoryFileService.createFile(fileName);
    };

    createFolder = (folderName: string): Observable<void> => {
        return this.repositoryFileService.createFolder(folderName);
    };

    /**
     * @function openDeleteFileModal
     * @desc Opens a popup to delete the selected repository file
     */
    openDeleteFileModal(item: TreeviewItem) {
        const { value: filePath } = item;
        const fileType = this.repositoryFiles[filePath];
        if (filePath) {
            const modalRef = this.modalService.open(CodeEditorFileBrowserDeleteComponent, { keyboard: true, size: 'lg' });
            modalRef.componentInstance.parent = this;
            modalRef.componentInstance.fileNameToDelete = filePath;
            modalRef.componentInstance.fileType = fileType;
        }
    }
}
