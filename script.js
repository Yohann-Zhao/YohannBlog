const cards = document.querySelectorAll('.subjects .card');
const detail = document.querySelector('.subject-detail');

// 假设你有一个学科信息的数组，包含每个学科对应的图片和详细说明
const subjectInfo = {
    'zh-CN': {
        'Aerodynamics (CADA)': {
            image: 'image_subject/CADA.png',
            description: '重点考察空气动力学原理，包括升力、阻力、俯仰稳定性、失速特性等。考生需掌握翼型、边界层控制、气流特性，并理解如何运用这些原理优化飞机操控。'
        },
        'Navigation (CNAV)': {
            image: 'image_subject/CNAV.jpg',
            description: '考察传统和现代导航方法，包括地文导航、无线电导航、GPS、飞行计划计算、航迹偏差修正等。考生需熟练使用航空图、计算航路燃油及时间，并理解导航误差的来源。'
        },
        'Meteorology (CMET)': {
            image: 'image_subject/CMET.jpg',
            description: '涉及天气系统、云的形成、风的影响、湍流、结冰等。考生需能解读航空天气图（TAF、METAR、SIGMET）、掌握气象预报的应用，并评估不同天气条件对飞行的影响。'
        },
        'Aircraft General Knowledge (CSYA)': {
            image: 'image_subject/CSYA.png',
            description: '涵盖飞机系统、发动机、仪表及电气系统的知识。考生需要理解活塞发动机和涡轮发动机的基本原理，掌握电气系统故障处理，以及飞行仪表（如姿态指引仪、空速表、陀螺仪等）的操作与误差分析。'
        },
        'Flight Planning and Performance (CFPA)': {
            image: 'image_subject/CFPA.jpg',
            description: '关注航前计划、重量与平衡计算、起降性能、燃油消耗、应急计划等。考生需掌握如何根据飞机手册（POH）计算飞机在不同条件下的性能。'
        },
        'Human Factors (CHUF)': {
            image: 'image_subject/CHUF.jpg',
            description: '涉及飞行员生理与心理影响，如疲劳管理、压力影响、态势感知、决策制定等。重点在于提高飞行安全性和减少人为错误。'
        },
        'Air Law (CLWA)': {
            image: 'image_subject/CLWA.jpg',
            description: '考察CASA法规、空域分类、ATC程序、最低安全高度、特定运行规则等。考生需熟悉AIP、CAR、CASR等相关法规，以确保合规飞行。'
        }
    },
    'en': {
        'Aerodynamics (CADA)': {
            image: 'image_subject/CADA.jpg',
            description: 'Focuses on the principles of aerodynamics, including lift, drag, pitch stability, and stall characteristics. Candidates need to master airfoil, boundary layer control, airflow characteristics, and understand how to apply these principles to optimize aircraft control.'
        },
        'Navigation (CNAV)': {
            image: 'image_subject/CNAV.jpg',
            description: 'Covers traditional and modern navigation methods, including celestial navigation, radio navigation, GPS, flight plan calculation, and track deviation correction. Candidates need to be proficient in using aeronautical charts, calculating route fuel and time, and understanding the sources of navigation errors.'
        },
        'Meteorology (CMET)': {
            image: 'image_subject/CMET.jpg',
            description: 'Involves weather systems, cloud formation, wind effects, turbulence, icing, etc. Candidates need to interpret aviation weather charts (TAF, METAR, SIGMET), master the application of weather forecasts, and assess the impact of different weather conditions on flight.'
        },
        'Aircraft General Knowledge (CSYA)': {
            image: 'image_subject/CSYA.jpg',
            description: 'Covers knowledge of aircraft systems, engines, instruments, and electrical systems. Candidates need to understand the basic principles of piston engines and turbine engines, master electrical system fault handling, and the operation and error analysis of flight instruments (such as attitude indicators, airspeed indicators, gyroscopes, etc.).'
        },
        'Flight Planning and Performance (CFPA)': {
            image: 'image_subject/CFPA.jpg',
            description: 'Focuses on pre-flight planning, weight and balance calculation, takeoff and landing performance, fuel consumption, emergency planning, etc. Candidates need to master how to calculate aircraft performance under different conditions according to the aircraft manual (POH).'
        },
        'Human Factors (CHUF)': {
            image: 'image_subject/CHUF.jpg',
            description: 'Involves physiological and psychological effects on pilots, such as fatigue management, stress impact, situational awareness, decision making, etc. The focus is on improving flight safety and reducing human errors.'
        },
        'Air Law (CLWA)': {
            image: 'image_subject/CLWA.jpg',
            description: 'Covers CASA regulations, airspace classification, ATC procedures, minimum safe altitudes, specific operation rules, etc. Candidates need to be familiar with AIP, CAR, CASR, and other relevant regulations to ensure compliant flight.'
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const lang = document.documentElement.lang;
    const defaultInfo = {
        'zh-CN': {
            image: 'image_subject/CPL.png',
            title: 'CASA CPLA 理论考试',
            description: 'CASA 商业飞行员执照（CPLA）理论考试是获取澳大利亚商用飞行员执照的必备笔试，涵盖七个科目：导航、气象学、空气动力学、飞机通识、飞行规则与法律、人为因素以及性能与载重。每个科目为单独考试，采用多项选择题、填空题。考试通过 Aspeq 系统在指定考点进行，大多数科目合格分数为 70% ，Air Law合格分数为 80 %。充分的学习与准备对顺利通过考试至关重要。'
        },
        'en': {
            image: 'image_subject/CPL.png',
            title: 'CASA CPLA Theory Exam',
            description: 'The CASA Commercial Pilot License (CPLA) theory exam is a mandatory written test for obtaining an Australian commercial pilot license, covering seven subjects: Navigation, Meteorology, Aerodynamics, Aircraft General Knowledge, Air Law, Human Factors, and Performance and Loading. Each subject is a separate exam, consisting of multiple-choice questions and fill-in-the-blank questions. The exam is conducted through the Aspeq system at designated test centers, with most subjects requiring a passing score of 70%, and Air Law requiring a passing score of 80%. Adequate study and preparation are crucial for passing the exam successfully.'
        }
    };

    // 显示默认的介绍图片和信息
    detail.querySelector('img').src = defaultInfo[lang].image;
    detail.querySelector('h2').textContent = defaultInfo[lang].title;
    detail.querySelector('p').textContent = defaultInfo[lang].description;
    detail.classList.add('active');
});

cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        const lang = document.documentElement.lang;
        // 获取当前学科的标题
        // 兼容 <h3> 结构
        const subjectTitle = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : card.textContent.trim();

        // 根据学科标题查找对应的详细信息
        const subject = subjectInfo[lang][subjectTitle];

        // 更新图片和文字
        if (subject) {
            detail.classList.add('active');
            detail.querySelector('img').src = subject.image;
            detail.querySelector('h2').textContent = subjectTitle;
            detail.querySelector('p').textContent = subject.description;
        }
    });

    card.addEventListener('mouseleave', () => {
        const lang = document.documentElement.lang;
        // 鼠标移开时始终重置为CPL.png和默认信息
        detail.querySelector('img').src = 'image_subject/CPL.png';
        detail.querySelector('h2').textContent = lang === 'zh-CN' ? 'CASA CPLA 理论考试' : 'CASA CPLA Theory Exam';
        detail.querySelector('p').textContent = lang === 'zh-CN'
            ? 'CASA 商业飞行员执照（CPLA）理论考试是获取澳大利亚商用飞行员执照的必备笔试，涵盖七个科目：导航、气象学、空气动力学、飞机通识、飞行规则与法律、人为因素以及性能与载重。每个科目为单独考试，采用多项选择题、填空题。考试通过 Aspeq 系统在指定考点进行，大多数科目合格分数为 70% ，Air Law合格分数为 80 %。充分的学习与准备对顺利通过考试至关重要。'
            : 'The CASA Commercial Pilot License (CPLA) theory exam is a mandatory written test for obtaining an Australian commercial pilot license, covering seven subjects: Navigation, Meteorology, Aerodynamics, Aircraft General Knowledge, Air Law, Human Factors, and Performance and Loading. Each subject is a separate exam, consisting of multiple-choice questions and fill-in-the-blank questions. The exam is conducted through the Aspeq system at designated test centers, with most subjects requiring a passing score of 70%, and Air Law requiring a passing score of 80%. Adequate study and preparation are crucial for passing the exam successfully.';
        detail.classList.add('active');
    });
});