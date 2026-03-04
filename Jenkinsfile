pipeline {
    agent any

    options { skipDefaultCheckout(true) }

    tools {
        nodejs 'Node18'
    }

    environment {
        IMAGE_NAME = "order-service"
        IMAGE_TAG  = "${BUILD_NUMBER}"
    }

    stages {
        stage('Sanity') {
            steps {
                sh 'which docker || true; docker --version || true; ls -la /var/run/docker.sock || true'
                sh 'echo BRANCH_NAME=$BRANCH_NAME; echo CHANGE_ID=$CHANGE_ID'
            }
        }

        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Container Build') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }

        stage('Security Scan') {
            steps {
                sh '''
                docker pull aquasec/trivy:latest
                docker run --rm \
                    -v /var/run/docker.sock:/var/run/docker.sock \
                    aquasec/trivy:latest image ${IMAGE_NAME}:${IMAGE_TAG}
                '''
            }
        }

        stage('Push (Dev)') {
        when {
            allOf {
                branch 'develop'
                not { changeRequest() }
            }
        }
        steps {
            withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
            )]) {
            sh '''
                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                docker tag ${IMAGE_NAME}:${IMAGE_TAG} $DOCKER_USER/${IMAGE_NAME}:dev-${IMAGE_TAG}
                docker push $DOCKER_USER/${IMAGE_NAME}:dev-${IMAGE_TAG}
                '''
            }
        }
        }

        stage('Push (Staging)') {
        when {
            allOf {
                expression { env.BRANCH_NAME ==~ /^release\\/.*$/ }
                not { changeRequest() }
            }
        }
        steps {
            withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
            )]) {
            sh '''
                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                docker tag ${IMAGE_NAME}:${IMAGE_TAG} $DOCKER_USER/${IMAGE_NAME}:rc-${IMAGE_TAG}
                docker push $DOCKER_USER/${IMAGE_NAME}:rc-${IMAGE_TAG}
            '''
            }
        }
        }

        stage('Approve Prod') {
        when {
            allOf {
            branch 'main'
            not { changeRequest() }
            }
        }
        steps {
            input message: "Deploy to PROD? (push ${IMAGE_NAME}:${IMAGE_TAG})", ok: "Approve"
        }
        }

        stage('Push (Prod)') {
        when {
            allOf {
            branch 'main'
            not { changeRequest() }
            }
        }
        steps {
            withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
            )]) {
            sh '''
                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                docker tag ${IMAGE_NAME}:${IMAGE_TAG} $DOCKER_USER/${IMAGE_NAME}:prod-${IMAGE_TAG}
                docker tag ${IMAGE_NAME}:${IMAGE_TAG} $DOCKER_USER/${IMAGE_NAME}:latest
                docker push $DOCKER_USER/${IMAGE_NAME}:prod-${IMAGE_TAG}
                docker push $DOCKER_USER/${IMAGE_NAME}:latest
            '''
            }
        }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
        }
    }
}