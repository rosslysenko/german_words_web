// Data loading and management
class WordsManager {
    constructor() {
        this.words = [];
        this.currentIndex = 0;
        this.difficultWords = new Set(JSON.parse(localStorage.getItem('difficultWords')) || []);
        this.progress = JSON.parse(localStorage.getItem('progress')) || {};
    }

    exportProgress() {
        try {
            // Prepare the data
            const data = {
                difficultWords: Array.from(this.difficultWords),
                progress: this.progress
            };

            // Create the blob with proper MIME type
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json;charset=utf-8'
            });

            // Create URL
            const url = URL.createObjectURL(blob);
            
            // Create and configure download link
            const a = document.createElement('a');
            a.href = url;
            a.download = 'german-words-progress.json'; // This sets the filename
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Помилка при експорті: ' + error.message);
        }
    }

    importProgress(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.difficultWords = new Set(data.difficultWords);
                    this.progress = data.progress;
                    
                    localStorage.setItem('difficultWords', JSON.stringify(Array.from(this.difficultWords)));
                    localStorage.setItem('progress', JSON.stringify(this.progress));
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    async loadWords() {
        try {
            const response = await fetch('js/words.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.words = await response.json();
        } catch (error) {
            console.error('Failed to load words:', error);
            alert('Помилка при завантаженні слів: ' + error.message);
        }
    }

    getCurrentWord() {
        return this.words[this.currentIndex];
    }

    markAsDifficult(wordId) {
        this.difficultWords.add(wordId);
        localStorage.setItem('difficultWords', JSON.stringify([...this.difficultWords]));
    }

    updateProgress(wordId, isCorrect) {
        if (!this.progress[wordId]) {
            this.progress[wordId] = { correct: 0, total: 0 };
        }
        this.progress[wordId].total++;
        if (isCorrect) {
            this.progress[wordId].correct++;
        }
        localStorage.setItem('progress', JSON.stringify(this.progress));
    }

    getProgress() {
        const totalWords = this.words.length;
        const learnedWords = Object.values(this.progress).filter(p => 
            (p.correct / p.total) >= 0.8
        ).length;
        return (learnedWords / totalWords) * 100;
    }
}

// UI Management
class UI {
    constructor(wordsManager) {
        this.wordsManager = wordsManager;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.studySection = document.getElementById('studySection');
        this.practiceSection = document.getElementById('practiceSection');
        this.difficultSection = document.getElementById('difficultSection');
        this.progressBar = document.getElementById('totalProgress');
        
        this.studyModeBtn = document.getElementById('studyMode');
        this.practiceModeBtn = document.getElementById('practiceMode');
        this.difficultWordsBtn = document.getElementById('difficultWords');
    }

    bindEvents() {
        this.studyModeBtn.addEventListener('click', () => this.showSection('study'));
        this.practiceModeBtn.addEventListener('click', () => this.showSection('practice'));
        this.difficultWordsBtn.addEventListener('click', () => this.showSection('difficult'));
        
        document.getElementById('showTranslation').addEventListener('click', () => {
            document.querySelector('.card-back').classList.remove('hidden');
        });

        document.getElementById('nextWord').addEventListener('click', () => {
            this.wordsManager.currentIndex = (this.wordsManager.currentIndex + 1) % this.wordsManager.words.length;
            this.updateCard();
        });

        document.getElementById('markAsDifficult').addEventListener('click', () => {
            const currentWord = this.wordsManager.getCurrentWord();
            this.wordsManager.markAsDifficult(currentWord.id);
        });

        document.getElementById('exportProgress').addEventListener('click', () => {
            this.wordsManager.exportProgress();
        });

        document.getElementById('importProgressBtn').addEventListener('click', () => {
            document.getElementById('importProgress').click();
        });

        document.getElementById('importProgress').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    await this.wordsManager.importProgress(e.target.files[0]);
                    this.updateProgress();
                    alert('Прогрес успішно завантажено!');
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Помилка при завантаженні прогресу: ' + error.message);
                }
            }
        });
    }

    showSection(section) {
        this.studySection.classList.add('hidden');
        this.practiceSection.classList.add('hidden');
        this.difficultSection.classList.add('hidden');

        switch(section) {
            case 'study':
                this.studySection.classList.remove('hidden');
                this.updateCard();
                break;
            case 'practice':
                this.practiceSection.classList.remove('hidden');
                this.startPractice();
                break;
            case 'difficult':
                this.difficultSection.classList.remove('hidden');
                this.showDifficultWords();
                break;
        }
    }

    updateCard() {
        const word = this.wordsManager.getCurrentWord();
        if (word) {
            document.getElementById('germanWord').textContent = word.german;
            document.getElementById('ukrainianWord').textContent = word.ukrainian;
            document.querySelector('.card-back').classList.add('hidden');
        }
    }

    startPractice() {
        const word = this.wordsManager.getCurrentWord();
        if (!word) return;

        const options = this.getRandomOptions(word);
        
        document.getElementById('practiceWord').textContent = word.german;
        const optionButtons = document.querySelectorAll('.option');
        
        options.forEach((option, index) => {
            optionButtons[index].textContent = option.ukrainian;
            optionButtons[index].onclick = () => {
                const isCorrect = option.id === word.id;
                this.wordsManager.updateProgress(word.id, isCorrect);
                this.showPracticeResult(isCorrect);
                this.updateProgress();
            };
        });
    }

    getRandomOptions(correctWord) {
        const options = [correctWord];
        const wordsCopy = [...this.wordsManager.words];
        const index = wordsCopy.findIndex(w => w.id === correctWord.id);
        wordsCopy.splice(index, 1);
        
        while (options.length < 4) {
            const randomIndex = Math.floor(Math.random() * wordsCopy.length);
            options.push(wordsCopy[randomIndex]);
            wordsCopy.splice(randomIndex, 1);
        }

        return this.shuffleArray(options);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showPracticeResult(isCorrect) {
        const resultElement = document.createElement('div');
        resultElement.className = `practice-result ${isCorrect ? 'correct' : 'incorrect'}`;
        resultElement.textContent = isCorrect ? 'Правильно!' : 'Неправильно!';
        this.practiceSection.appendChild(resultElement);
        
        setTimeout(() => {
            resultElement.remove();
            this.wordsManager.currentIndex = (this.wordsManager.currentIndex + 1) % this.wordsManager.words.length;
            this.startPractice();
        }, 1500);
    }

    showDifficultWords() {
        const difficultWordsList = document.querySelector('.difficult-words-list');
        difficultWordsList.innerHTML = '';
        
        this.wordsManager.words
            .filter(word => this.wordsManager.difficultWords.has(word.id))
            .forEach(word => {
                const wordElement = document.createElement('div');
                wordElement.className = 'difficult-word';
                wordElement.innerHTML = `
                    <h3>${word.german} - ${word.ukrainian}</h3>
                `;
                difficultWordsList.appendChild(wordElement);
            });
    }

    updateProgress() {
        const progress = this.wordsManager.getProgress();
        this.progressBar.style.width = `${progress}%`;
    }
}

// Initialize application
async function initApp() {
    try {
        const wordsManager = new WordsManager();
        await wordsManager.loadWords();
        const ui = new UI(wordsManager);
        ui.showSection('study');
        ui.updateProgress();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Помилка при ініціалізації додатку: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', initApp);